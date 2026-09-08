import Link from "next/link";
import { notFound } from "next/navigation";

import { DealWizard } from "@/components/deals/deal-wizard";
import { getDeal } from "@/lib/deals/repo";

export const metadata = { title: "Deal" };

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <Link href="/deals" className="text-xs text-zinc-500 hover:underline">
          ← All deals
        </Link>
        <h1 className="text-xl font-semibold">{deal.propertyAddress}</h1>
        <p className="font-mono text-sm text-zinc-500">
          {deal.legalDescription.legalDescription}
        </p>
        <p className="text-xs text-zinc-400">
          Lot {deal.legalDescription.lot || "—"} · Block{" "}
          {deal.legalDescription.block || "—"} ·{" "}
          {deal.legalDescription.addition || "—"} ·{" "}
          {deal.legalDescription.city || "—"}
        </p>
      </div>
      <DealWizard deal={deal} />
    </main>
  );
}
