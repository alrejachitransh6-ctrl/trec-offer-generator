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

## Environment

Copy the root `.env.example` to `.env.local` and fill in the project URL and
keys from the Supabase dashboard (or from `supabase start` output for local
development).
