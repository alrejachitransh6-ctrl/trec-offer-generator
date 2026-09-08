import { getUser } from "@/lib/supabase/auth";
import { getDeal } from "@/lib/deals/repo";
import { fillTrec20_19 } from "@/lib/trec/fill-20-19";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET → the filled TREC 20-19 PDF as a download. */
export async function GET(_request: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) {
    return new Response("Not authenticated", { status: 401 });
  }

  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return new Response("Not found", { status: 404 });

  let result;
  try {
    result = await fillTrec20_19(deal);
  } catch (err) {
    console.error("fillTrec20_19 failed", err);
    return new Response("Could not generate the PDF", { status: 500 });
  }

  const slug = deal.propertyAddress
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);

  return new Response(result.bytes as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="trec-1-4-${slug || deal.id}.pdf"`,
      "x-fill-warnings": String(result.warnings.length),
    },
  });
}
