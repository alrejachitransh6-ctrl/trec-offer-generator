# TREC Offer Generator

Web app for generating filled TREC (Texas Real Estate Commission) real-estate
contract forms from structured offer data.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, `src/`)
- Tailwind CSS v4
- [Supabase](https://supabase.com) — Auth + Postgres, via `@supabase/ssr`
- [pdf-lib](https://pdf-lib.js.org) — PDF AcroForm filling

## Getting started

```bash
cp .env.example .env.local     # fill in the STAGING Supabase project values
npm install
npm run dev                     # http://localhost:3000
```

Requires Node 20+ (`node` 26.x installed via Homebrew on this machine).

## Environments

Two isolated deployments, each with its own Supabase project:

| Branch    | Environment                       | Supabase project     |
| --------- | --------------------------------- | -------------------- |
| `staging` | staging (default working branch)  | `trec-offer-staging` |
| `main`    | production (promote deliberately) | `trec-offer-prod`    |

Pushing a branch auto-deploys it to the matching Vercel environment. **Do routine
work on `staging`; only merge to `main` to go live.** Full setup and promotion
runbook: [`docs/environments.md`](docs/environments.md).

## Scripts

| Command                           | Purpose                  |
| --------------------------------- | ------------------------ |
| `npm run dev`                     | Dev server               |
| `npm run build` / `npm start`     | Production build / serve |
| `npm run lint`                    | ESLint                   |
| `npm run typecheck`               | `tsc --noEmit`           |
| `npm run format` / `format:check` | Prettier                 |

## Docs

- [`docs/architecture.md`](docs/architecture.md) — stack, request lifecycle, directory map
- [`docs/environments.md`](docs/environments.md) — staging/production split, deployment
- [`CLAUDE.md`](CLAUDE.md) — context for AI coding sessions
- [`supabase/README.md`](supabase/README.md) — local Supabase + migrations
