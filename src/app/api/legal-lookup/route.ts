import { NextResponse } from "next/server";

import { getUser } from "@/lib/supabase/auth";
import { getCounty } from "@/lib/counties/registry";
import {
  legalLookupRequestSchema,
  type LegalLookupResponse,
} from "@/lib/validations/legal-lookup";

export const runtime = "nodejs";
// CAD lookup + model call can take a few seconds.
export const maxDuration = 30;

/**
 * POST { address, countyId } → attempt to resolve the property's legal
 * description from the county appraisal district. Never persists; the caller
 * shows the result for explicit confirmation (spec §5).
 */
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

  const parsed = legalLookupRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const county = getCounty(parsed.data.countyId);

  if (!county.adapter) {
    const body: LegalLookupResponse = {
      supported: false,
      sourceUrl: county.cadUrl,
      pageContext: "",
      extracted: null,
    };
    return NextResponse.json(body);
  }

  try {
    const result = await county.adapter.lookup(parsed.data.address);
    const body: LegalLookupResponse = { supported: true, ...result };
    return NextResponse.json(body);
  } catch (err) {
    // Adapters are contracted not to throw; this is a last-resort guard.
    console.error("legal-lookup adapter threw", err);
    return NextResponse.json(
      { error: "Lookup failed unexpectedly" },
      { status: 502 },
    );
  }
}
