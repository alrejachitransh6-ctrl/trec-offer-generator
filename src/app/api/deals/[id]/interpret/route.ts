import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { interpretOverrides } from "@/lib/ai/interpret-overrides";
import { getDeal } from "@/lib/deals/repo";
import { interpretOverridesSchema } from "@/lib/validations/deal";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST { note } → { changes, unmapped }
 *
 * Interprets the "anything different about this deal" note into structured
 * changes. Does not persist — the client shows the changes for accept/reject,
 * then PUTs the accepted ones onto the deal.
 */
export async function POST(request: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = interpretOverridesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await interpretOverrides(parsed.data.note);
    return NextResponse.json(result);
  } catch (err) {
    console.error("interpretOverrides failed", err);
    return NextResponse.json(
      {
        error:
          "Could not interpret the note. Try rewording, or add changes manually.",
      },
      { status: 502 },
    );
  }
}
