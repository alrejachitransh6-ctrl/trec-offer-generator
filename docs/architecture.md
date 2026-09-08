# Architecture

## Stack

| Concern        | Choice                              |
| -------------- | ----------------------------------- |
| Framework      | Next.js 16 (App Router, TypeScript) |
| Styling        | Tailwind CSS v4                     |
| Auth           | Supabase Auth via `@supabase/ssr`   |
| Database       | Supabase Postgres                   |
| PDF generation | `pdf-lib` (AcroForm field filling)  |
| Hosting        | Vercel (assumed)                    |

## Request lifecycle for auth

1. `src/proxy.ts` runs on every matched request and calls `updateSession`
   (`src/lib/supabase/middleware.ts`), which refreshes the Supabase token and
   writes cookies onto the response.
2. Server Components / Route Handlers create a per-request client with
   `createClient()` from `src/lib/supabase/server.ts` (async — `cookies()` is
   async in Next 16).
3. Client Components use `createClient()` from `src/lib/supabase/client.ts`.

Route protection is centralized in `updateSession` (currently a no-op stub).

## PDF form filling

`src/lib/pdf/fill-form.ts` provides form-agnostic helpers:

- `inspectPdfFields(bytes)` — enumerate a template's fields and their types.
- `fillPdfForm(bytes, values, options)` — set text / checkbox / radio / dropdown
  fields, optionally flatten, and return the output bytes.

Blank PDF templates live in `public/templates/`. Mapping specific documents onto
`PdfFieldValues` is feature work and does not belong in `src/lib/pdf/`.

## Directory map

```
src/
  app/
    (auth)/            unauthenticated routes (login, sign-up)
    (app)/             authenticated routes (dashboard, ...)
    auth/callback/     OAuth / PKCE code exchange
    auth/confirm/      email OTP / magic-link verification
    api/health/        liveness probe
  components/          React components (ui/ = primitives, auth/ = auth widgets)
  config/site.ts       static app metadata
  hooks/               shared React hooks
  lib/
    env.ts             validated environment-variable access
    supabase/          client / server / proxy Supabase factories + DB types
    pdf/               generic pdf-lib form-filling helpers
    utils.ts           small shared helpers
    validations/       shared schema/validation (empty for now)
  types/               shared TypeScript types
supabase/
  migrations/          SQL migrations
public/templates/      blank PDF form templates
```
