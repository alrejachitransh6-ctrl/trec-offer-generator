# Changelog

Notable changes to the project. Newest first.

## Unreleased

- Project scaffold: Next.js 16 + Supabase (`@supabase/ssr`) + pdf-lib, production
  folder structure, validated env access.
- Staging / production split: `staging` → Vercel Preview (branch-pinned), `main`
  → Production; two separate Supabase projects; env badge + `/api/health`
  environment reporting.
- Deployment pipeline smoke test on staging.
