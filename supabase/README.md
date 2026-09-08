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

Order so far: `0001_profiles.sql`, `0002_deals.sql`. Apply to **staging**
(`aggwvdaakdduzsgztdsz`) first, verify, then production.

## Auth setup (magic link)

Sign-in is passwordless magic link, restricted to a fixed set of users. This
works with Supabase's **default** email templates — no custom SMTP needed.

1. **Authentication → Providers → Email**: enable. Turn **off** "Confirm email"
   (we only ever send magic links to pre-created accounts).
2. **Authentication → Sign-ups**: disable open sign-ups. (`shouldCreateUser` is
   already `false` client-side.)
3. **Authentication → URL Configuration**:
   - **Site URL**: the staging URL (and `http://localhost:3000` works for local
     because it's also added below).
   - **Redirect URLs**: add `http://localhost:3000/**`, `<staging-url>/**`, and
     later `<prod-url>/**`.
     The default email link (`{{ .ConfirmationURL }}`) verifies at Supabase and
     redirects to `<emailRedirectTo>?code=…`, which the app's `/auth/callback`
     route exchanges for a session. No email-template edits required.
4. **Authentication → Users → Add user**: create each allowed account
   (currently `chrisflips01@gmail.com`), "Auto Confirm User" on. The
   `on_auth_user_created` trigger adds their `profiles` row.
5. Set `AUTH_ALLOWED_EMAILS` (same addresses) locally and in Vercel.

> Note: the default link uses the PKCE code flow, so the magic link must be
> opened in the **same browser** that requested it. Fine for local/staging;
> revisit with custom SMTP + a `token_hash` template if cross-device links are
> needed.

## Environment

Copy the root `.env.example` to `.env.local` and fill in the project URL and
keys from the Supabase dashboard (or from `supabase start` output for local
development).
