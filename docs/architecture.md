# Architecture

## Stack

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript) |
| Styling        | Tailwind CSS v4                     |
| Auth           | Supabase Auth via `@supabase/ssr`   |
| Database       | Supabase Postgres                   |
| PDF generation | `pdf-lib` (AcroForm field filling)  |
| Runtime AI     | Anthropic API (`@anthropic-ai/sdk`) |
| Hosting        | Vercel (assumed)                    |

## Runtime AI (spec §5)

AI is used **at runtime**, deliberately scoped:

- **`src/lib/ai/parse-address.ts`** — `claude-haiku-4-5` normalises a free-form
  address ("9820 ash creek dr dallas texas 75228") into `{ streetNumber,
streetName, direction }` for the CAD search. Deterministic post-processing
  strips street suffixes / stray markup; a regex heuristic is the fallback if
  the call fails.
- **`src/lib/ai/extract-cad-property.ts`** — given the text of a county
  appraisal district page, `claude-sonnet-5` returns a structured
  `LegalDescription` **plus `ownerName`** (normalised to natural order —
  "John Q Smith", or Title Case for entities/trusts), forced tool call,
  zod-validated. Told to extract only what's present, never infer; a leaked or
  non-name `ownerName` is dropped rather than surfaced. The owner pre-fills the
  Seller field and the signature line — always user-confirmed. The CAD page URL
  (`sourceUrl`) is carried into the deal's `legal_description` jsonb.
- **`src/lib/ai/interpret-overrides.ts`** — maps a deal's free-text "anything
  different" note onto the fixed `OVERRIDE_TARGETS` catalog
  (`src/lib/deals/override-catalog.ts`) via `claude-sonnet-5`. Returns
  `{ changes, unmapped }`; the user accepts/rejects each change before it's
  persisted. Ask-every-time fields are deliberately out of scope for this
  (they're in the wizard) and get pushed to `unmapped`.
- Model IDs live in `src/lib/ai/client.ts` (`MODELS`).
- The extracted legal description is **always** surfaced for explicit user
  confirmation before use (spec §5 hard rule) — see `/lookup`.

Deterministic, non-AI: choosing which CAD site to hit (`src/lib/counties/`),
writing PDF fields, all DB reads/writes.

## Deals (slice 2)

- `deals` table: property + confirmed `legal_description` + `defaults` snapshot
  - `terms` (ask-every-time fields) + `override_note` + `overrides` (accepted
    structured changes). RLS: owner-only. `src/lib/deals/repo.ts` is the only
    place that reads/writes it (zod-parses jsonb on the way out).
- `src/lib/deals/defaults.ts` — `DEFAULT_PREFERENCES` constant, snapshotted onto
  each deal at creation. Slice 4 replaces the constant with a table + UI.
- `src/lib/deals/override-catalog.ts` — the closed set of normally-FIXED/DEFAULT
  TREC points a per-deal note may change.
- `src/lib/validations/deal.ts` — `dealTermsSchema` (every field defaulted via
  `.prefault({})` so partial saves coerce), override + API payload schemas.
- Wizard: `src/components/deals/deal-wizard.tsx` (client), one page, save writes
  the whole `terms` object.

## County legal-description lookup

- `src/lib/counties/list.ts` — client-safe county metadata (the `<select>`).
- `src/lib/counties/registry.ts` — server-only; attaches an adapter per county.
- `src/lib/counties/adapters/dallas.ts` — drives the DallasCAD (ASP.NET
  WebForms) address search: primes `__VIEWSTATE`, posts with
  `__EVENTTARGET=cmdSubmit`, follows the account link, extracts page text, hands
  it to the model. Never throws — failures return `{ error, extracted: null }`
  and the UI falls back to manual entry.
- Tarrant / Denton / Collin: `adapter: null` → manual entry until built.
- `POST /api/legal-lookup` (auth-gated, `nodejs` runtime) orchestrates; it does
  not persist (the confirmed value moves into a deal in a later slice).

## Request lifecycle for auth

1. `src/proxy.ts` runs on every matched request and calls `updateSession`
   (`src/lib/supabase/middleware.ts`), which refreshes the Supabase token and
   writes cookies onto the response.
2. Server Components / Route Handlers create a per-request client with
   `createClient()` from `src/lib/supabase/server.ts` (async — `cookies()` is
   async in Next 16).
3. Client Components use `createClient()` from `src/lib/supabase/client.ts`.

Route protection: `updateSession` coarsely redirects unauthenticated requests
for `/lookup`, `/dashboard`, `/settings` to `/login`. The canonical check —
session **and** email allowlist (`AUTH_ALLOWED_EMAILS`) — is `requireUser()` in
`src/app/(app)/layout.tsx` — it also signs out an authenticated user whose
email isn't allowlisted. Sign-in is **email + password** (`signInWithPassword`)
with **magic link** as a fallback (`signInWithOtp`, `shouldCreateUser: false`);
accounts are created by hand in the Supabase dashboard. Password sign-in avoids
Supabase's built-in-SMTP rate limit. `/auth/callback` is a **client page** that
accepts both link styles — `?code=` (PKCE) and `#access_token=` (implicit, e.g.
a dashboard-generated link) — then routes on; the allowlist check is downstream
in the layout.

## PDF form filling

`src/lib/pdf/fill-form.ts` has form-agnostic helpers (`inspectPdfFields`,
`fillPdfForm`). Document-specific mapping lives under `src/lib/trec/`:

- **`public/templates/trec-20-19.pdf`** — the current official TREC form. Its
  280 AcroForm fields have meaningless Acrobat-generated names, so they're
  addressed by **index** in `form.getFields()` (a stable order).
- **`scripts/overlay-pdf-fields.mjs`** — renders the form with each field's
  index + outline overlaid, and a legend. This is how `field-map.ts` was built;
  re-run it if the template is ever swapped.
- **`src/lib/trec/field-map.ts`** — index → meaning, verified against
  `docs/spec.md` §7 and `docs/trec-field-inventory.txt`.
- **`src/lib/trec/fill-20-19.ts`** — `fillTrec20_19(deal)`. Deterministic (no
  AI). FIXED values straight from the spec; ASK from `deal.terms`; per-deal
  overrides applied to safe text fields, with structural ones (survey option,
  addenda boxes, §12B split) raised as `warnings` for manual completion.
  Signature names are _drawn_ on the signature lines (they're `PDFSignature`
  fields). `outputFileTracingIncludes` in `next.config.ts` bundles the template
  with the API function.
- **`src/lib/trec/readiness.ts`** — `dealWarnings(deal)`, a pure check surfaced
  on the deal page and merged into the fill result.
- **`GET /api/deals/[id]/pdf`** streams the download.

## Directory map

```
src/
  app/
    (auth)/login/      email+password sign-in (magic-link fallback)
    (app)/             authenticated routes — layout.tsx runs requireUser()
      lookup/          legal-description lookup + "start deal" (slice 1)
      deals/           deal list + [id] wizard (slice 2)
      dashboard/       placeholder
    auth/callback/     client page — ?code= or #access_token= → session, route on
    auth/signout/      POST → sign out
    api/health, api/legal-lookup
    api/deals, api/deals/[id], api/deals/[id]/interpret
  components/          auth/, lookup/, deals/ (deal-wizard), ui/ (empty)
  config/site.ts       static app metadata
  lib/
    env.ts             validated env access + APP_ENV guard
    supabase/          client / server / proxy factories, auth.ts, DB types
    ai/                Anthropic client, parse-address, extract-cad-property,
                       interpret-overrides
    counties/          list.ts (client), registry.ts + adapters/ (server)
    deals/             repo.ts (server CRUD), defaults.ts, override-catalog.ts
    pdf/               generic pdf-lib form-filling helpers
    validations/       zod schemas (legal-lookup.ts, deal.ts)
    utils.ts
  types/
    trec/              field-map.ts, fill-20-19.ts, readiness.ts (slice 3)
supabase/migrations/   0001_profiles.sql, 0002_deals.sql
public/templates/      trec-20-19.pdf
scripts/               inspect-pdf-fields.mjs, overlay-pdf-fields.mjs
docs/spec.md           the feature spec (source of truth)
```
