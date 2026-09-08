import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { getDeal, updateDeal } from "@/lib/deals/repo";
import { dealUpdateSchema } from "@/lib/validations/deal";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET → { deal } */
export async function GET(_request: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deal });
}

/** PUT { terms?, status?, overrideNote?, overrides? } → { deal } */
export async function PUT(request: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = dealUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const deal = await updateDeal(id, parsed.data);
    if (!deal)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (err) {
    console.error("updateDeal failed", err);
    return NextResponse.json(
      { error: "Could not save the deal" },
      { status: 500 },
    );
  }
}
