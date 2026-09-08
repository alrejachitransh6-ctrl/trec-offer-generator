# Environments & Deployment

This project runs as **two isolated deployments** backed by **two separate
Supabase projects**. Staging exists so changes can be verified against real
infrastructure before they ever reach production.

> **Hosting plan: Vercel Hobby (free).** We do **not** use Vercel Custom
> Environments (that is a Pro feature). Staging runs on the **Preview**
> environment, pinned to the `staging` branch with a stable branch domain.
> Do not reintroduce Custom Environments in docs or setup steps.

|                       | **Staging**                                 | **Production**                                      |
| --------------------- | ------------------------------------------- | --------------------------------------------------- |
| Git branch            | `staging`                                   | `main`                                              |
| Vercel environment    | **Preview**, pinned to the `staging` branch | **Production**                                      |
| `NEXT_PUBLIC_APP_ENV` | `staging`                                   | `production`                                        |
| Supabase project      | `aggwvdaakdduzsgztdsz` (its own database)   | production project — not created yet                |
| Who deploys           | automatic on push to `staging`              | automatic on push to `main` — **done deliberately** |

**Stable staging URL:** Vercel keeps a branch alias
(`…-git-staging-<scope>.vercel.app`) pointed at the latest `staging` deployment,
or you can assign a custom domain to the `staging` branch. Either is the URL you
test on — never a per-deployment preview URL. Setup in step 3 below.

The two Supabase projects **never share a database**. Staging cannot touch
production data because the production keys exist only in Vercel's Production
environment — nothing local or on a Preview build can reach them.

## Branch → environment flow

```
feature work ─▶ commit to `staging` ─▶ push ─▶ Vercel Preview build (staging branch) ─▶ verify
                                                                          │
                                                          looks good?  ───┘
                                                                          ▼
                                          merge `staging` ─▶ `main` ─▶ push ─▶ Vercel Production build
```

- **Default working branch is `staging`.** All routine work happens here.
- `main` is promotion-only. Never commit directly to `main`; only fast-forward
  merges from `staging` after staging has been verified.
- `main` should always be a subset of what has already run on `staging`.
- Keep other long-lived branches out of this repo. Any branch that is pushed
  gets a Preview build; without branch-scoped env vars it will fail its build at
  `src/lib/env.ts` (missing vars) rather than boot with the wrong credentials —
  safe, but noisy.

## Environment variables

Local development uses `.env.local` (git-ignored, created from `.env.example`).
Staging and production variables are **set in the Vercel dashboard only**.

On Hobby, a variable's scope is one or more of **Production**, **Preview**,
**Development** — and a Preview variable can additionally be pinned to a single
git branch. We use that to keep the staging keys on the `staging` branch only.

| Variable                               | Local (`.env.local`)    | Vercel — Preview, branch = `staging` | Vercel — Production      |
| -------------------------------------- | ----------------------- | ------------------------------------ | ------------------------ |
| `NEXT_PUBLIC_APP_ENV`                  | `development`           | `staging`                            | `production`             |
| `NEXT_PUBLIC_SUPABASE_URL`             | staging project URL     | staging project URL                  | **prod** project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable key | staging publishable key              | **prod** publishable key |
| `SUPABASE_SECRET_KEY`                  | staging secret key      | staging secret key                   | **prod** secret key      |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000` | staging branch URL                   | production URL           |

Notes:

- Never give the same Supabase value both Production and Preview scope.
- `src/lib/env.ts` resolves the environment from `NEXT_PUBLIC_APP_ENV`, and
  falls back to `staging` when Vercel reports `VERCEL_ENV=preview` **and**
  `VERCEL_GIT_COMMIT_REF=staging` — so a forgotten `NEXT_PUBLIC_APP_ENV` on the
  branch still behaves correctly. It also throws at startup if
  `APP_ENV=production` while the Supabase URL looks non-production.

## One-time setup checklist

Items marked 🧑 require your Vercel / Supabase accounts and cannot be done from
the repo.

### 1. Supabase — two projects 🧑

1. **Staging project — done.** Ref `aggwvdaakdduzsgztdsz`; its URL, publishable
   key, and secret key are already in local `.env.local`.
2. Create the **production** Supabase project (its own database). This is a
   later step — not needed to test staging.
3. From each project's **Settings → API Keys**, copy the Project URL, the
   publishable key (`sb_publishable_...`), and the secret key (`sb_secret_...`).
   Keep the two sets clearly labelled.

### 2. Vercel — project + Git 🧑

1. Import this Git repo into Vercel. **Settings → Git → Production Branch =
   `main`**.
2. Leave Preview Deployments enabled (default). The `staging` branch will get a
   Preview deployment on every push.

### 3. Vercel — stable staging domain 🧑

**Settings → Domains**, then either:

- **Simplest:** copy the auto-generated stable branch alias
  `…-git-staging-<scope>.vercel.app` — Vercel keeps this pointed at the latest
  `staging` deployment automatically. Nothing to configure.
- **Or** add a custom domain (e.g. `staging.yourdomain.com`), edit it, and set
  its **Git Branch = `staging`** so it always tracks that branch.

Use whichever URL you picked as `NEXT_PUBLIC_SITE_URL` for the Preview/`staging`
scope.

### 4. Vercel — environment variables 🧑

**Settings → Environment Variables.** For each row in the table above:

- **Production** scope → the **prod** Supabase values, `NEXT_PUBLIC_APP_ENV=production`.
- **Preview** scope, **Branch = `staging`** → the **staging** Supabase values,
  `NEXT_PUBLIC_APP_ENV=staging`. (Add the variable, choose Preview, then pick
  "Specific Branch" → `staging`.)

### 5. Push branches — done

`main` and `staging` are both on
`github.com/alrejachitransh6-ctrl/trec-offer-generator`. Once the Vercel project
exists it builds `main` → Production and `staging` → a Preview deployment
reachable at the stable staging domain.

## Verifying a change on staging before production

1. Work on `staging`, commit, `git push origin staging`.
2. Wait for the Vercel Preview build, then open the stable staging domain.
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
