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

  // Route protection lives here once auth pages exist. Example:
  //
  // const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  // if (!user && !isAuthRoute) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }
  void user;

  return supabaseResponse;
}
