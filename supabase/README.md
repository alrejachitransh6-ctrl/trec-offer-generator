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

Order so far: `0001_profiles.sql`. Apply to **staging**
(`aggwvdaakdduzsgztdsz`) first, verify, then production.

## Auth setup (magic link)

Sign-in is passwordless magic link, restricted to a fixed set of users.

1. **Authentication → Providers → Email**: enable, keep "Confirm email" on.
2. **Authentication → Sign-ups**: disable open sign-ups (`shouldCreateUser` is
   already `false` client-side, but disable it here too).
3. **Authentication → URL Configuration**: add the site + redirect URLs
   (`http://localhost:3000`, the staging URL, later production) and allow
   `**/auth/confirm`.
4. **Authentication → Email Templates → Magic Link**: set the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}`.
5. **Authentication → Users → Add user**: create each allowed account
   (currently `chrisflips01@gmail.com`). The `on_auth_user_created` trigger
   adds their `profiles` row.
6. Set `AUTH_ALLOWED_EMAILS` (same addresses) locally and in Vercel.

## Environment

Copy the root `.env.example` to `.env.local` and fill in the project URL and
keys from the Supabase dashboard (or from `supabase start` output for local
development).
