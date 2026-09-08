@AGENTS.md

# TREC Offer Generator

Web app for generating filled TREC (Texas Real Estate Commission) real-estate
contract forms from structured offer data. A user enters offer details, the app
fills the corresponding blank TREC PDF form(s), and returns a completed PDF.

**Status:** scaffold only. Environment, dependencies, folder structure, and the
staging/production split are in place. No contract-specific logic has been
written yet.

## ⚠️ Environments — read before doing anything

Two isolated deployments, each with its **own Supabase project and database**:

|                       | Staging                                 | Production             |
| --------------------- | --------------------------------------- | ---------------------- |
| Branch                | **`staging`**                           | **`main`**             |
| Vercel env            | **Preview**, pinned to `staging` branch | **Production**         |
| `NEXT_PUBLIC_APP_ENV` | `staging`                               | `production`           |
| Supabase              | `trec-offer-staging`                    | `trec-offer-prod`      |
| Deploys               | auto on push to `staging`               | auto on push to `main` |

**Hosting is Vercel Hobby (free).** Staging is a **Preview** deployment pinned
to the `staging` branch with a stable branch domain, with its env vars scoped to
Preview + branch `staging`. Do **not** suggest Vercel Custom Environments — that
is a Pro feature and is deliberately not used here.

**Rules for every session (agent or human):**

- **Work on `staging` by default.** It is the checked-out branch. All feature
  work, migrations, and experiments happen here.
- **`main` = production. Treat it as deliberate promotion only.** Never commit
  to `main` directly. Only `git merge --ff-only staging` into `main` after the
  change has been verified running on the staging deployment, and only when the
  user explicitly asks to promote / go live / ship to production.
- Staging and production **never share a database.** Production keys exist only
  in Vercel's Production environment; nothing local or on staging can reach
  production data.
- Local dev (`.env.local`) points at the **staging** Supabase project.
- Verify a change on staging via the amber **STAGING** badge (bottom-right) and
  `GET /api/health` (`appEnv` + `supabaseUrl` + commit SHA).

Full runbook, including the one-time Vercel/Supabase account setup: see
[`docs/environments.md`](docs/environments.md).

## Stack

- **Next.js 16** — App Router, TypeScript, `src/` directory. Note: Next 16
  renamed Middleware to **Proxy** (`src/proxy.ts`), and `cookies()` / `headers()`
  / `params` / `searchParams` are **async**. Read `node_modules/next/dist/docs/`
  before writing framework code (see `AGENTS.md`).
- **Tailwind CSS v4** — configured via `@tailwindcss/postcss`, no `tailwind.config`.
- **Supabase** — Auth (magic link) + Postgres, via `@supabase/ssr`.
- **pdf-lib** — fills AcroForm fields in PDF templates (later slice).
- **`@anthropic-ai/sdk`** — runtime AI (legal-description extraction).
- **`zod`** — request + AI-output validation. **`cheerio`** — CAD HTML parsing.
- **Prettier** with `prettier-plugin-tailwindcss`.

## Layout

```
src/
  app/
    (auth)/login/           magic-link sign-in
    (app)/layout.tsx        requireUser() gate for everything below
    (app)/lookup/           legal-description lookup + "start deal" (slice 1)
    (app)/deals/            deal list + /deals/[id] wizard (slice 2)
    (app)/dashboard/        placeholder
    auth/callback/route.ts  magic-link (PKCE code) → session + allowlist re-check
    auth/signout/route.ts   POST → sign out
    api/health, api/legal-lookup
    api/deals (POST), api/deals/[id] (GET/PUT), api/deals/[id]/interpret (POST)
  components/  auth/, lookup/, deals/ (deal-wizard), ui/ (empty)
  components/env-badge.tsx  non-prod environment badge
  config/site.ts            static app metadata
  lib/
    env.ts                  validated env-var access + APP_ENV + prod/staging guard
    supabase/               client.ts / server.ts (async) / middleware.ts /
                            auth.ts (getUser, requireUser, isEmailAllowed)
    ai/                     client.ts (MODELS), parse-address, extract-legal-description,
                            interpret-overrides
    counties/               list.ts (client-safe meta), registry.ts + adapters/
                            (server; dallas.ts is live, others manual-entry)
    deals/                  repo.ts (server CRUD), defaults.ts, override-catalog.ts
    pdf/fill-form.ts         generic, form-agnostic pdf-lib helpers
    validations/            legal-lookup.ts, deal.ts (zod)
    utils.ts
  proxy.ts                   Next 16 proxy → updateSession (coarse route gate)
supabase/migrations/         0001_profiles.sql, 0002_deals.sql (apply via dashboard SQL editor)
public/templates/            blank TREC 20-19 PDF (later slice)
docs/spec.md                 feature spec — source of truth
docs/architecture.md         fuller architecture notes
```

## Conventions

- Path alias: `@/*` → `src/*`.
- Read env vars through `src/lib/env.ts`, which validates and fails fast.
- Supabase server client is **async** — `const supabase = await createClient()`.
- Keep `src/lib/pdf/` form-agnostic. Document-specific field mappings are feature
  code and live elsewhere (e.g. `src/lib/trec/` when created).
- PDF templates are static assets in `public/templates/`.
- **AI at runtime is deliberate and narrow** (spec §5): reading CAD pages and
  (later) NL overrides. Everything else — county routing, PDF fill, DB — is
  plain code. Model IDs only in `src/lib/ai/client.ts`.
- **Never import `src/lib/counties/registry.ts` or `adapters/` into client
  components** — they pull in the Anthropic SDK + `cheerio`. Use
  `src/lib/counties/list.ts` for UI.
- The looked-up legal description is **always** user-confirmed before use.
- CAD adapters must never throw — return `{ error, extracted: null }`.
- All deal DB access goes through `src/lib/deals/repo.ts`; RLS + `user_id`
  filter both enforce ownership.
- The NL override box maps **only** to `override-catalog.ts` targets. Ask-every-
  time fields belong in the wizard; the interpreter pushes them to `unmapped`.
- `dealTermsSchema` fields all use `.prefault({})` — partial input coerces to a
  full object so drafts always save.

## Setup

```bash
cp .env.example .env.local   # fill in the STAGING Supabase URL + keys
npm install
npm run dev
```

You should be on the `staging` branch (`git branch --show-current`).

Node is installed via Homebrew (`node` 26.x). If `node` is not on PATH in a new
shell, ensure `/opt/homebrew/bin` is in PATH.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` / `format:check` — Prettier

## Not done yet

- Staging prereqs: `0002_deals.sql` must be applied (SQL editor). `0001` +
  `ANTHROPIC_API_KEY` + magic-link setup already done.
- Production Supabase project not created; prod-scoped Vercel env vars pending.
- Tarrant / Denton / Collin CAD adapters (manual entry only for now).
- Slice 3: TREC 20-19 field map + PDF fill (`docs/trec-field-inventory.txt`,
  spec §7). Slice 4: editable `user_preferences` (replaces `DEFAULT_PREFERENCES`).
- Deal has no "generate PDF" / "mark ready" flow yet; `terms` completeness is
  not enforced (drafts save partial).
- No tests configured.
