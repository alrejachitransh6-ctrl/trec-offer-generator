import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { createDeal } from "@/lib/deals/repo";
import { dealCreateSchema } from "@/lib/validations/deal";

export const runtime = "nodejs";

/** POST { propertyAddress, countyId, legalDescription } → { id } */
export async function POST(request: Request) {
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

  const parsed = dealCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const id = await createDeal(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("createDeal failed", err);
    return NextResponse.json(
      { error: "Could not create the deal" },
      { status: 500 },
    );
  }
}
