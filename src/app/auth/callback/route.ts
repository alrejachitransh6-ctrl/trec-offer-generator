import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth redirect target for magic links (and OAuth/PKCE, later).
 *
 * Works with Supabase's **default** email template — the default
 * `{{ .ConfirmationURL }}` verifies server-side at Supabase, then redirects
 * here with `?code=…` (PKCE). We exchange it for a session, re-check the
 * allowlist, and send the user on to `next`.
 *
 * Also tolerates the token-hash style link (`?token_hash=…&type=…`) in case a
 * custom email template is configured later.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = sanitizeNext(searchParams.get("next"));

  const supabase = await createClient();

  let email: string | null | undefined;
  let ok = false;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    email = data.user?.email;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      // `type` is validated by Supabase; cast to its enum.
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
      token_hash: tokenHash,
    });
    ok = !error;
    email = data.user?.email;
  }

  if (!ok) {
    return NextResponse.redirect(
      new URL("/login?error=link_invalid", request.url),
    );
  }

  if (!isEmailAllowed(email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=not_allowed", request.url),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}

/** Only allow same-origin relative paths as the post-login destination. */
function sanitizeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/lookup";
}
