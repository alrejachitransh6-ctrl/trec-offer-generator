import Link from "next/link";

import { listDeals } from "@/lib/deals/repo";

export const metadata = { title: "Deals" };

export default async function DealsPage() {
  const deals = await listDeals();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Deals</h1>
        <Link
          href="/lookup"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
        >
          New deal
        </Link>
      </div>

      {deals.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No deals yet. Start one from a property lookup.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deals.map((deal) => (
            <li key={deal.id}>
              <Link
                href={`/deals/${deal.id}`}
                className="flex flex-col gap-0.5 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="text-sm font-medium">
                  {deal.propertyAddress}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {deal.legalDescription.legalDescription ||
                    "(no legal description)"}
                </span>
                <span className="text-xs text-zinc-400">
                  {deal.status} · updated{" "}
                  {new Date(deal.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
