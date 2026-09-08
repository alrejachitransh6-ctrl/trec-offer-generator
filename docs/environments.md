# Environments & Deployment

This project runs as **two fully isolated deployments** with **two separate
Supabase projects**. Staging exists so changes can be verified against real
infrastructure before they ever reach production.

|                       | **Staging**                                        | **Production**                                      |
| --------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Git branch            | `staging`                                          | `main`                                              |
| Purpose               | private testing of unreleased changes              | what real users see                                 |
| Vercel environment    | custom environment `staging`                       | Production                                          |
| `NEXT_PUBLIC_APP_ENV` | `staging`                                          | `production`                                        |
| Supabase project      | `trec-offer-staging` (its own database)            | `trec-offer-prod` (its own database)                |
| URL                   | `staging.<domain>` (or the Vercel `*-staging` URL) | `<domain>`                                          |
| Who deploys           | automatic on push to `staging`                     | automatic on push to `main` — **done deliberately** |

The two Supabase projects **never share a database**. Staging tests cannot touch
production data because staging simply has no credentials for the production
project — those keys live only in the Production environment on Vercel.

## Branch → environment flow

```
feature work ─▶ commit to `staging` ─▶ push ─▶ Vercel builds staging ─▶ verify
                                                                          │
                                                          looks good?  ───┘
                                                                          ▼
                                          merge `staging` ─▶ `main` ─▶ push ─▶ Vercel builds production
```

- **Default working branch is `staging`.** All routine work happens here.
- `main` is promotion-only. Never commit directly to `main`; only fast-forward
  merges from `staging` after staging has been verified.
- `main` should always be a subset of what has already run on `staging`.

## Environment variables

Local development uses `.env.local` (git-ignored, created from `.env.example`).
Staging and production variables are **set in the Vercel dashboard only**, scoped
per environment so the two key sets are never mixed.

| Variable                               | Local (`.env.local`)    | Vercel `staging` env    | Vercel Production env    |
| -------------------------------------- | ----------------------- | ----------------------- | ------------------------ |
| `NEXT_PUBLIC_APP_ENV`                  | `development`           | `staging`               | `production`             |
| `NEXT_PUBLIC_SUPABASE_URL`             | staging project URL     | staging project URL     | **prod** project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable key | staging publishable key | **prod** publishable key |
| `SUPABASE_SECRET_KEY`                  | staging secret key      | staging secret key      | **prod** secret key      |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000` | staging URL             | production URL           |

`src/lib/env.ts` throws at startup if `NEXT_PUBLIC_APP_ENV=production` while the
Supabase URL looks non-production — a backstop against swapped keys.

## One-time setup checklist

Items marked 🧑 require your Vercel / Supabase accounts and cannot be done from
the repo.

### 1. Supabase — two projects 🧑

1. Create Supabase project **`trec-offer-staging`**.
2. Create Supabase project **`trec-offer-prod`**.
3. From each project's **Settings → API Keys**, copy the Project URL, the
   publishable key (`sb_publishable_...`), and the secret key (`sb_secret_...`).
   Keep the two sets clearly labelled.
4. Put the **staging** set into your local `.env.local`.

### 2. Vercel — project + environments 🧑

1. Import this Git repo into Vercel. Set **Production Branch = `main`**
   (Settings → Git).
2. Create a **Custom Environment** named `staging`
   (Settings → Environments → Add) and attach it to the **`staging`** branch.
3. Under Settings → Git, disable preview deployments for other branches (or
   leave them — they will fail closed without env vars, but disabling keeps
   things tidy).

### 3. Vercel — environment variables 🧑

Add each variable from the table above:

- Production environment → **prod** Supabase values, `NEXT_PUBLIC_APP_ENV=production`.
- `staging` environment → **staging** Supabase values, `NEXT_PUBLIC_APP_ENV=staging`.
  Never tick both environments for the same Supabase value.

### 4. Push branches

```bash
git push -u origin main
git push -u origin staging
```

Vercel then builds `main` → Production and `staging` → the staging environment.

## Verifying a change on staging before production

1. Work on `staging`, commit, `git push origin staging`.
2. Wait for the Vercel build, then open the staging URL.
   - The **STAGING** badge (amber, bottom-right) confirms which env you are on.
   - `GET /api/health` returns `{"appEnv":"staging","supabaseUrl":"...staging..."}`
     plus the deployed commit SHA.
3. Exercise the change against staging data.
4. Only once it checks out:
   ```bash
   git checkout main
   git merge --ff-only staging
   git push origin main
   git checkout staging
   ```
5. Confirm production the same way — badge is hidden in production, but
   `/api/health` returns `{"appEnv":"production","supabaseUrl":"...prod..."}`.

## Database migrations

Apply schema changes to **staging first**, verify, then apply the identical
migration to production. See `supabase/README.md`. Migrations are plain SQL in
`supabase/migrations/` and run in filename order against whichever project the
Supabase CLI is linked to — double-check `supabase projects list` / the linked
ref before `db push`.
