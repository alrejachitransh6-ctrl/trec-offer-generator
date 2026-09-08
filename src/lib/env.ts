/**
 * Centralized, validated access to environment variables.
 *
 * Import from here instead of reading `process.env` directly so that a missing
 * or malformed variable fails fast with a clear message at startup rather than
 * surfacing as a confusing runtime error deep in the app.
 *
 * See `docs/environments.md` for how variables are scoped per environment
 * (local / staging / production).
 */

export type AppEnv = "development" | "staging" | "production";

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function parseAppEnv(value: string | undefined): AppEnv {
  if (
    value === "production" ||
    value === "staging" ||
    value === "development"
  ) {
    return value;
  }
  // Fall back to Vercel's own signal, then to development for local work.
  if (process.env.VERCEL_ENV === "production") return "production";
  return "development";
}

const NEXT_PUBLIC_SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

const appEnv = parseAppEnv(process.env.NEXT_PUBLIC_APP_ENV);

/**
 * Guard against the single most dangerous misconfiguration: a production
 * deployment pointed at a non-production Supabase project, or a staging
 * deployment pointed at the production one.
 */
if (
  appEnv === "production" &&
  /staging|preview|dev/i.test(NEXT_PUBLIC_SUPABASE_URL)
) {
  throw new Error(
    "NEXT_PUBLIC_APP_ENV=production but NEXT_PUBLIC_SUPABASE_URL looks like a " +
      "non-production project. Check the environment variables for this deployment.",
  );
}

/** Variables safe to reference in browser (client) code. */
export const clientEnv = {
  /** Which deployment this is. Drives environment badges and safety checks. */
  APP_ENV: appEnv,
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isProduction = appEnv === "production";
export const isStaging = appEnv === "staging";

/**
 * Server-only variables. Accessing this from client code will throw because the
 * values are `undefined` in the browser bundle.
 */
export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
};
