# Supabase

Local Supabase project configuration and database migrations.

## Layout

- `migrations/` — SQL migration files, applied in filename order.
- `config.toml` — created by `supabase init` (not yet run).

## Getting started

The Supabase CLI is not committed as a dependency. Install it via Homebrew or
run it with `npx`:

```bash
brew install supabase/tap/supabase
# or: npx supabase <command>
```

Initialize and start the local stack:

```bash
supabase init
supabase start
```

Create a migration:

```bash
supabase migration new <name>
```

Apply migrations to the local database:

```bash
supabase db reset
```

Regenerate TypeScript types after a schema change:

```bash
supabase gen types typescript --local > ../src/lib/supabase/database.types.ts
```

## Applying migrations to a hosted project (no local stack)

For staging/production we run the SQL directly. Simplest path:

1. Open the project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of each new file in `migrations/` (in order) and run it.
   The files are idempotent (`if not exists`, `drop … if exists`).

Order so far: `0001_profiles.sql`, `0002_deals.sql`,
`0003_profiles_buyer_info.sql`. Apply to **staging** (`aggwvdaakdduzsgztdsz`)
first, verify, then production.

## Auth setup

Sign-in is **email + password** (primary) with **magic link** as a fallback,
restricted to a fixed set of users provisioned by hand. Password sign-in sends
no email, so it isn't affected by Supabase's built-in-SMTP rate limit
(~2–4 emails/hour) — magic link is.

1. **Authentication → Providers → Email**: enable. Turn **off** "Confirm email".
2. **Authentication → Sign-ups**: disable open sign-ups (`shouldCreateUser` is
   already `false` client-side).
3. **Authentication → URL Configuration**:
   - **Site URL**: the staging branch URL (this is where dashboard-generated
     links redirect).
   - **Redirect URLs**: `http://localhost:3000/**`, `<staging-url>/**`, later
     `<prod-url>/**`.
4. **Authentication → Users → Add user**: for each allowed person set an
   email + password and turn on "Auto Confirm User". The `on_auth_user_created`
   trigger adds their `profiles` row. Give them the password out-of-band; they
   sign in at `/login`.
5. Set `AUTH_ALLOWED_EMAILS` (comma-separated, same addresses) locally and in
   Vercel (Preview scope, branch `staging`). Redeploy after changing it.

`/auth/callback` is a client page that accepts both link styles — PKCE
(`?code=`, from the app's own magic-link request) and implicit
(`#access_token=`, from a link generated in the Supabase dashboard). The email
allowlist is enforced by `requireUser()` in `src/app/(app)/layout.tsx`, which
signs out anyone not on the list.

> Rate-limited on magic-link email? Add a user with a password instead, or
> Authentication → Users → (user) → **Generate link** and open it yourself.

## Environment

Copy the root `.env.example` to `.env.local` and fill in the project URL and
keys from the Supabase dashboard (or from `supabase start` output for local
development).
