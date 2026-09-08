import Link from "next/link";
import { notFound } from "next/navigation";

import { DealWizard } from "@/components/deals/deal-wizard";
import { getDeal } from "@/lib/deals/repo";
import { dealWarnings } from "@/lib/trec/readiness";

export const metadata = { title: "Deal" };

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const warnings = dealWarnings(deal);

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

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Generate contract</h2>
        <p className="text-xs text-zinc-500">
          Fills the TREC 20-19 from this deal&apos;s <strong>saved</strong>{" "}
          data. Always review the generated PDF before sending.
        </p>

        {warnings.length > 0 && (
          <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-medium">
              {warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
              or complete:
            </p>
            <ul className="mt-1 ml-4 list-disc">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={`/api/deals/${deal.id}/pdf`}
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          Download filled TREC 20-19 (PDF)
        </a>
      </section>
    </main>
  );
}
