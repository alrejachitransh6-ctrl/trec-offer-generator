import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Runs on every matched request (via `src/proxy.ts`).
 *
 * Responsibilities:
 *  - Refresh the Supabase auth token and write refreshed cookies onto the
 *    response so Server Components downstream see a valid session.
 *  - Optionally gate routes that require an authenticated user.
 *
 * IMPORTANT: always return the `supabaseResponse` object as-is (or a redirect
 * that copies its cookies). Breaking this contract can log users out at random.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it can cause
  // hard-to-debug session desync.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Coarse gate only. The allowlist check + canonical redirect live in
  // `src/app/(app)/layout.tsx` via `requireUser()`.
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/lookup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

const PROTECTED_PREFIXES = ["/lookup", "/dashboard", "/settings"];
