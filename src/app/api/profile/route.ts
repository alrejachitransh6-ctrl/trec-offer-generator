import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { getBuyerDefault, setBuyerDefault } from "@/lib/deals/repo";
import { buyerDefaultSchema } from "@/lib/validations/deal";

export const runtime = "nodejs";

/** GET → { buyerNameInfo } */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ buyerNameInfo: await getBuyerDefault() });
}

/** PUT { buyerNameInfo } → saves the standing Buyer default for new deals. */
export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = buyerDefaultSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await setBuyerDefault(parsed.data.buyerNameInfo.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("setBuyerDefault failed", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
