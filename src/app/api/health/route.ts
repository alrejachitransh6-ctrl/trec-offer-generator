import { NextResponse } from "next/server";

import { clientEnv } from "@/lib/env";

/**
 * Liveness probe. Reports which environment answered and which Supabase project
 * it is wired to — handy for confirming a deploy landed where expected.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    appEnv: clientEnv.APP_ENV,
    supabaseUrl: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    timestamp: new Date().toISOString(),
  });
}
