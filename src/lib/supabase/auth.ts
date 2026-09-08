import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side auth helpers. Import these in Server Components, Route Handlers,
 * and Server Actions — never in client code.
 */

/** Current authenticated user, or `null`. */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Require an authenticated, allowlisted user. Redirects to `/login` when absent
 * (for use in Server Components / layouts). Returns the user otherwise.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user || !isEmailAllowed(user.email)) {
    redirect("/login");
  }
  return user;
}

/** Whether an email address is permitted to sign in (see `AUTH_ALLOWED_EMAILS`). */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = serverEnv.authAllowedEmails;
  // Empty allowlist = deny everyone. Fail closed.
  return allowed.includes(email.trim().toLowerCase());
}
