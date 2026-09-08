# Changelog

Notable changes to the project. Newest first.

## Unreleased

- Slice 1 — legal-description lookup (spec §10 step 1):
  - Magic-link auth (Supabase OTP), email allowlist backstop, `(app)` route
    group gated by `requireUser()`, sign-out.
  - County registry (Dallas/Tarrant/Denton/Collin); Dallas CAD adapter does a
    real DallasCAD address search + detail-page fetch.
  - Runtime AI: `claude-sonnet-5` extracts the legal description from the CAD
    page text (`src/lib/ai/`). Result always shown for explicit confirmation.
  - `POST /api/legal-lookup`; `/lookup` UI with confidence badge, source link,
    "what the lookup read", editable fields, and a Confirm step.
  - `profiles` table + RLS (`supabase/migrations/0001_profiles.sql`).
  - Tarrant/Denton/Collin: manual-entry path until their adapters land.
- Project scaffold: Next.js 16 + Supabase (`@supabase/ssr`) + pdf-lib, production
  folder structure, validated env access.
- Staging / production split: `staging` → Vercel Preview (branch-pinned), `main`
  → Production; two separate Supabase projects; env badge + `/api/health`
  environment reporting.
- Deployment pipeline smoke test on staging.
