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
- **`src/lib/ai/extract-legal-description.ts`** — given the text of a county
  appraisal district page, `claude-sonnet-5` returns a structured
  `LegalDescription` (forced tool call, zod-validated). It is told to extract
  only what's present and never infer.
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
`src/app/(app)/layout.tsx`. Sign-in is magic link only (`signInWithOtp`,
`shouldCreateUser: false`); accounts are created in the Supabase dashboard.
The email link uses Supabase's default template → `/auth/callback` exchanges
the PKCE `code` for a session, re-checks the allowlist, and signs out anyone
not on it.

## PDF form filling

`src/lib/pdf/fill-form.ts` provides form-agnostic helpers:

- `inspectPdfFields(bytes)` — enumerate a template's fields and their types.
- `fillPdfForm(bytes, values, options)` — set text / checkbox / radio / dropdown
  fields, optionally flatten, and return the output bytes.

Blank PDF templates live in `public/templates/`. Mapping specific documents onto
`PdfFieldValues` is feature work and does not belong in `src/lib/pdf/`.

## Directory map

```
src/
  app/
    (auth)/login/      magic-link sign-in
    (app)/             authenticated routes — layout.tsx runs requireUser()
      lookup/          legal-description lookup + "start deal" (slice 1)
      deals/           deal list + [id] wizard (slice 2)
      dashboard/       placeholder
    auth/callback/     magic-link (PKCE code) → session + allowlist re-check
    auth/signout/      POST → sign out
    api/health, api/legal-lookup
    api/deals, api/deals/[id], api/deals/[id]/interpret
  components/          auth/, lookup/, deals/ (deal-wizard), ui/ (empty)
  config/site.ts       static app metadata
  lib/
    env.ts             validated env access + APP_ENV guard
    supabase/          client / server / proxy factories, auth.ts, DB types
    ai/                Anthropic client, parse-address, extract-legal-description,
                       interpret-overrides
    counties/          list.ts (client), registry.ts + adapters/ (server)
    deals/             repo.ts (server CRUD), defaults.ts, override-catalog.ts
    pdf/               generic pdf-lib form-filling helpers
    validations/       zod schemas (legal-lookup.ts, deal.ts)
    utils.ts
  types/
supabase/migrations/   0001_profiles.sql, 0002_deals.sql
public/templates/      blank TREC 20-19 PDF (added in a later slice)
docs/spec.md           the feature spec (source of truth)
```
