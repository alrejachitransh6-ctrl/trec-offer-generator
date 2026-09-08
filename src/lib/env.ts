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
  // Fall back to Vercel's own signals if NEXT_PUBLIC_APP_ENV was not set.
  if (process.env.VERCEL_ENV === "production") return "production";
  // On the Hobby plan staging is a Preview deploy pinned to the `staging`
  // branch (see docs/environments.md) — treat that branch as staging even if
  // the branch-scoped NEXT_PUBLIC_APP_ENV is missing.
  if (
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "staging"
  ) {
    return "staging";
  }
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
  // Supabase "publishable" key (sb_publishable_...). Safe for the browser.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
  /** Supabase "secret" key (sb_secret_...). Full access — never expose. */
  get SUPABASE_SECRET_KEY(): string {
    return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
  /** Anthropic API key for runtime AI calls (legal-description extraction, etc.). */
  get ANTHROPIC_API_KEY(): string {
    return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
  },
  /**
   * Comma-separated allowlist of email addresses permitted to sign in.
   * Backstop for the Supabase dashboard's sign-up restriction — magic-link
   * requests and confirmations for any other address are rejected.
   */
  get authAllowedEmails(): string[] {
    return (process.env.AUTH_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
};
