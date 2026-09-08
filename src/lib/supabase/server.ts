import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions.
 *
 * `cookies()` is async in Next.js 16, so this function must be awaited.
 * The `setAll` call is wrapped in try/catch because Server Components cannot
 * write cookies — token refresh there is handled by the proxy instead
 * (see `src/proxy.ts` / `src/lib/supabase/middleware.ts`).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — safe to ignore when the proxy
            // is refreshing sessions.
          }
        },
      },
    },
  );
}
