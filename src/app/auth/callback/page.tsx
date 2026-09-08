"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Establishes a session from an auth redirect, then sends the user on.
 *
 * Handles both link styles:
 *  - `?code=…`  — PKCE, from our own `signInWithOtp` call.
 *  - `#access_token=…&refresh_token=…` — implicit flow, e.g. a link generated
 *    from the Supabase dashboard.
 *
 * The email allowlist is enforced downstream by `requireUser()` in
 * `src/app/(app)/layout.tsx` (it signs out anyone not on the list).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    const next = sanitizeNext(params.get("next") ?? hash.get("next"));

    async function run() {
      const code = params.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return setError(error.message);
      } else if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) return setError(error.message);
      } else {
        return setError("This sign-in link is missing its token.");
      }

      // Clear the token from the address bar, then continue.
      window.history.replaceState(null, "", url.pathname);
      router.replace(next);
    }

    void run();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 p-8">
      {error ? (
        <>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <a href="/login" className="text-sm underline">
            Back to sign in
          </a>
        </>
      ) : (
        <p className="text-sm text-zinc-500">Signing you in…</p>
      )}
    </main>
  );
}

function sanitizeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/lookup";
}
