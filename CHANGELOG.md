# Changelog

Notable changes to the project. Newest first.

## Unreleased

- Slice 2 — deals + ask-every-time wizard + NL overrides (spec §6/§7):
  - `deals` table + RLS (`supabase/migrations/0002_deals.sql`). Each deal
    snapshots the standing defaults (`DEFAULT_PREFERENCES`, code constant for
    now — slice 4 makes them editable).
  - `/lookup` "Confirm & start deal" creates a deal and opens `/deals/[id]`;
    `/deals` lists them.
  - `/deals/[id]` — single-page sectioned form: Seller, Sales Price, Earnest/
    Escrow/Option, Title, Closing Date, HOA, Special Provisions, Signatories.
  - "Anything different about this deal?" box → `claude-sonnet-5` maps the note
    to a fixed catalog of overridable TREC points (`override-catalog.ts`); the
    user accepts/rejects each change before it's saved to the deal.
  - `POST /api/deals`, `PUT /api/deals/[id]`, `POST /api/deals/[id]/interpret`.
- Slice 1 — legal-description lookup (spec §10 step 1):
  - Magic-link auth (Supabase OTP) using the **default** email template —
    `/auth/callback` exchanges the PKCE code, re-checks the email allowlist;
    `(app)` route group gated by `requireUser()`; sign-out. No custom SMTP.
  - County registry (Dallas/Tarrant/Denton/Collin); Dallas CAD adapter does a
    real DallasCAD address search + detail-page fetch.
  - Runtime AI: `claude-haiku-4-5` normalises the free-form address; the DCAD
    adapter searches on the base street name (suffix stripped, directional
    retried); `claude-sonnet-5` extracts the legal description from the CAD
    page text (`src/lib/ai/`). Result always shown for explicit confirmation.
  - `POST /api/legal-lookup`; `/lookup` UI with confidence badge, source link,
    "what the lookup read", editable fields, and a Confirm step.
  - `profiles` table + RLS (`supabase/migrations/0001_profiles.sql`).
  - Tarrant/Denton/Collin: manual-entry path until their adapters land.
  - Staging wired: Supabase magic-link auth configured, `0001_profiles.sql`
    applied, `ANTHROPIC_API_KEY` + `AUTH_ALLOWED_EMAILS` set in Vercel.
- Project scaffold: Next.js 16 + Supabase (`@supabase/ssr`) + pdf-lib, production
  folder structure, validated env access.
- Staging / production split: `staging` → Vercel Preview (branch-pinned), `main`
  → Production; two separate Supabase projects; env badge + `/api/health`
  environment reporting.
- Deployment pipeline smoke test on staging.
