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

|                       | Staging                   | Production             |
| --------------------- | ------------------------- | ---------------------- |
| Branch                | **`staging`**             | **`main`**             |
| `NEXT_PUBLIC_APP_ENV` | `staging`                 | `production`           |
| Supabase              | `trec-offer-staging`      | `trec-offer-prod`      |
| Deploys               | auto on push to `staging` | auto on push to `main` |

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
- **Supabase** — Auth + Postgres, accessed through `@supabase/ssr`.
- **pdf-lib** — fills AcroForm fields in PDF templates.
- **Prettier** with `prettier-plugin-tailwindcss`.

## Layout

```
src/
  app/
    (auth)/login/          unauthenticated routes (placeholder)
    (app)/dashboard/        authenticated routes (placeholder)
    auth/callback/route.ts  OAuth / PKCE code exchange
    auth/confirm/route.ts   email OTP / magic-link verification
    api/health/route.ts     liveness probe
    layout.tsx, page.tsx, globals.css
  components/  ui/ (primitives), auth/ (auth widgets)
  components/env-badge.tsx  non-prod environment badge
  config/site.ts            static app metadata
  hooks/
  lib/
    env.ts                  validated env-var access + APP_ENV + prod/staging guard
    supabase/
      client.ts             browser client (Client Components)
      server.ts             server client (async; Server Components / Route Handlers / Actions)
      middleware.ts          updateSession() — token refresh + route protection
      database.types.ts     generated DB types (placeholder until schema exists)
    pdf/fill-form.ts         generic, form-agnostic pdf-lib helpers
    utils.ts
    validations/             shared validation schemas (empty)
  types/
  proxy.ts                   Next 16 proxy → calls updateSession
supabase/migrations/         SQL migrations (run `supabase init` to add config.toml)
public/templates/            blank TREC PDF form templates go here
docs/architecture.md         fuller architecture notes
```

## Conventions

- Path alias: `@/*` → `src/*`.
- Read env vars through `src/lib/env.ts`, which validates and fails fast.
- Supabase server client is **async** — `const supabase = await createClient()`.
- Keep `src/lib/pdf/` form-agnostic. Document-specific field mappings are feature
  code and live elsewhere (e.g. `src/lib/trec/` when created).
- PDF templates are static assets in `public/templates/`.

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

- Supabase projects not created (need two: staging + prod); no schema, no RLS
  policies, no migrations.
- Vercel project not created; branch→environment auto-deploy and per-environment
  env vars need the one-time account setup in `docs/environments.md`.
- No real auth UI or session gating (stub in `updateSession`).
- No TREC forms, field mappings, or offer data model.
- No tests configured.
