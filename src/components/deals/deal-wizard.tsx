"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Deal } from "@/lib/deals/repo";
import { OVERRIDE_TARGETS, overrideTarget } from "@/lib/deals/override-catalog";
import type {
  DealTerms,
  OverrideChange,
  OverrideInterpretation,
} from "@/lib/validations/deal";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type InterpretState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: OverrideInterpretation }
  | { kind: "error"; message: string };

export function DealWizard({ deal }: { deal: Deal }) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [terms, setTerms] = useState<DealTerms>(() => ({
    ...deal.terms,
    closingDate: {
      ...deal.terms.closingDate,
      year: deal.terms.closingDate.year || currentYear,
    },
  }));
  const [note, setNote] = useState(deal.overrideNote);
  const [overrides, setOverrides] = useState<OverrideChange[]>(deal.overrides);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [interpret, setInterpret] = useState<InterpretState>({ kind: "idle" });
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const buyerInfo = deal.defaults.buyerNameInfo;

  function patch(update: (t: DealTerms) => DealTerms) {
    setTerms(update);
    setSave({ kind: "idle" });
  }

  async function persist(extra?: {
    overrides?: OverrideChange[];
    note?: string;
  }) {
    setSave({ kind: "saving" });
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          terms,
          overrideNote: extra?.note ?? note,
          overrides: extra?.overrides ?? overrides,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSave({
          kind: "error",
          message: body.error ?? `Save failed (${res.status})`,
        });
        return;
      }
      setSave({ kind: "saved" });
      router.refresh();
    } catch (err) {
      setSave({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function runInterpret() {
    if (!note.trim()) return;
    setInterpret({ kind: "loading" });
    setPicked(new Set());
    try {
      const res = await fetch(`/api/deals/${deal.id}/interpret`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInterpret({
          kind: "error",
          message: body.error ?? `Failed (${res.status})`,
        });
        return;
      }
      setInterpret({ kind: "done", result: body as OverrideInterpretation });
      setPicked(
        new Set((body.changes ?? []).map((_: unknown, i: number) => i)),
      );
    } catch (err) {
      setInterpret({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  function applyPicked() {
    if (interpret.kind !== "done") return;
    const chosen = interpret.result.changes.filter((_, i) => picked.has(i));
    // one override per target; a newer change wins
    const byTarget = new Map<string, OverrideChange>();
    for (const o of overrides) byTarget.set(o.targetId, o);
    for (const c of chosen) byTarget.set(c.targetId, c);
    const merged = [...byTarget.values()];
    setOverrides(merged);
    setInterpret({ kind: "idle" });
    void persist({ overrides: merged });
  }

  function removeOverride(targetId: string) {
    const merged = overrides.filter((o) => o.targetId !== targetId);
    setOverrides(merged);
    void persist({ overrides: merged });
  }

  const closingComplete = useMemo(
    () =>
      terms.closingDate.day > 0 &&
      terms.closingDate.month > 0 &&
      terms.closingDate.year > 0,
    [terms.closingDate],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Buyer (standing default) */}
      <Section
        title="Buyer"
        hint="Your standing default (TREC §1). Editable in Settings later, or override below for this deal."
      >
        <p className="text-sm">
          {overrides.find((o) => o.targetId === "buyer_name_info")?.newValue ||
            buyerInfo || (
              <span className="text-amber-600 dark:text-amber-400">
                Not set — will be blank on the contract.
              </span>
            )}
        </p>
      </Section>

      {/* Seller */}
      <Section title="Seller" hint="TREC §1">
        <Field label="Seller name / info">
          <textarea
            rows={2}
            className={inputCls}
            value={terms.seller.nameInfo}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                seller: { ...t.seller, nameInfo: e.target.value },
              }))
            }
          />
        </Field>
      </Section>

      {/* Sales price */}
      <Section
        title="Sales price"
        hint="TREC §3. All-cash: §3C total equals the cash portion; §3B financing is left blank."
      >
        <Field label="Cash portion (USD)">
          <MoneyInput
            value={terms.salesPrice.cashPortionUsd}
            onChange={(v) =>
              patch((t) => ({
                ...t,
                salesPrice: { cashPortionUsd: v },
              }))
            }
          />
        </Field>
        <p className="text-xs text-zinc-500">
          Sales price (§3C): {formatUsd(terms.salesPrice.cashPortionUsd)}
        </p>
      </Section>

      {/* Earnest money / escrow / option */}
      <Section title="Earnest money, escrow & option" hint="TREC §5">
        <Field label="Escrow agent name">
          <input
            className={inputCls}
            value={terms.earnestMoney.escrowAgentName}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                earnestMoney: {
                  ...t.earnestMoney,
                  escrowAgentName: e.target.value,
                },
              }))
            }
          />
        </Field>
        <Field label="Escrow agent address">
          <input
            className={inputCls}
            value={terms.earnestMoney.escrowAgentAddress}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                earnestMoney: {
                  ...t.earnestMoney,
                  escrowAgentAddress: e.target.value,
                },
              }))
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Earnest money (USD)">
            <MoneyInput
              value={terms.earnestMoney.earnestMoneyUsd}
              onChange={(v) =>
                patch((t) => ({
                  ...t,
                  earnestMoney: { ...t.earnestMoney, earnestMoneyUsd: v },
                }))
              }
            />
          </Field>
          <Field label="Option fee (USD)">
            <MoneyInput
              value={terms.earnestMoney.optionFeeUsd}
              onChange={(v) =>
                patch((t) => ({
                  ...t,
                  earnestMoney: { ...t.earnestMoney, optionFeeUsd: v },
                }))
              }
            />
          </Field>
        </div>
        <Field label="Option period (days) — §5B">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={terms.earnestMoney.optionPeriodDays || ""}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                earnestMoney: {
                  ...t.earnestMoney,
                  optionPeriodDays: Math.max(0, e.target.valueAsNumber || 0),
                },
              }))
            }
          />
        </Field>
      </Section>

      {/* Title */}
      <Section title="Title company" hint="TREC §6">
        <Field label="Title company name">
          <input
            className={inputCls}
            value={terms.title.titleCompanyName}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                title: { titleCompanyName: e.target.value },
              }))
            }
          />
        </Field>
      </Section>

      {/* Closing date */}
      <Section
        title="Closing date"
        hint="TREC §9A. An incomplete date defaults the year to the current contract year."
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Day">
            <input
              type="number"
              min={1}
              max={31}
              className={inputCls}
              value={terms.closingDate.day || ""}
              onChange={(e) =>
                patch((t) => ({
                  ...t,
                  closingDate: {
                    ...t.closingDate,
                    day: clamp(e.target.valueAsNumber, 0, 31),
                  },
                }))
              }
            />
          </Field>
          <Field label="Month">
            <input
              type="number"
              min={1}
              max={12}
              className={inputCls}
              value={terms.closingDate.month || ""}
              onChange={(e) =>
                patch((t) => ({
                  ...t,
                  closingDate: {
                    ...t.closingDate,
                    month: clamp(e.target.valueAsNumber, 0, 12),
                  },
                }))
              }
            />
          </Field>
          <Field label="Year">
            <input
              type="number"
              className={inputCls}
              value={terms.closingDate.year || ""}
              onChange={(e) =>
                patch((t) => ({
                  ...t,
                  closingDate: {
                    ...t.closingDate,
                    year: clamp(e.target.valueAsNumber, 0, 9999),
                  },
                }))
              }
            />
          </Field>
        </div>
        {!closingComplete && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Closing date is incomplete.
          </p>
        )}
      </Section>

      {/* HOA */}
      <Section
        title="HOA / property owners association"
        hint="TREC §7 title notices item (2)"
      >
        <div className="flex flex-col gap-1 text-sm">
          {(
            [
              ["is", "IS subject to mandatory membership"],
              ["is_not", "is NOT subject to mandatory membership"],
              ["unknown", "Unknown / not determined"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="hoa"
                checked={terms.hoa.mandatoryMembership === value}
                onChange={() =>
                  patch((t) => ({
                    ...t,
                    hoa: { mandatoryMembership: value },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      {/* Special provisions */}
      <Section
        title="Special provisions"
        hint='TREC §11. Left as "n/a" if you have nothing to add.'
      >
        <textarea
          rows={3}
          className={inputCls}
          value={terms.specialProvisions}
          onChange={(e) =>
            patch((t) => ({ ...t, specialProvisions: e.target.value }))
          }
        />
      </Section>

      {/* Signatories */}
      <Section
        title="Signatory names"
        hint="The people who actually sign — not the entity name."
      >
        <Field label="Buyer signatory name(s)">
          <input
            className={inputCls}
            value={terms.signatories.buyerNames}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                signatories: {
                  ...t.signatories,
                  buyerNames: e.target.value,
                },
              }))
            }
          />
        </Field>
        <Field label="Seller signatory name(s)">
          <input
            className={inputCls}
            value={terms.signatories.sellerNames}
            onChange={(e) =>
              patch((t) => ({
                ...t,
                signatories: {
                  ...t.signatories,
                  sellerNames: e.target.value,
                },
              }))
            }
          />
        </Field>
      </Section>

      {/* Save */}
      <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => persist()}
          disabled={save.kind === "saving"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {save.kind === "saving" ? "Saving…" : "Save deal"}
        </button>
        {save.kind === "saved" && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved ✓
          </span>
        )}
        {save.kind === "error" && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {save.message}
          </span>
        )}
      </div>

      {/* Overrides */}
      <Section
        title="Anything different about this deal?"
        hint="Describe changes to the standing defaults in plain language — e.g. “seller pays for the survey this time, and credit the buyer $5,000 toward closing costs.” We'll turn it into specific contract changes for you to approve."
      >
        <textarea
          rows={3}
          className={inputCls}
          placeholder="e.g. seller pays for the survey this time"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runInterpret}
            disabled={!note.trim() || interpret.kind === "loading"}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
          >
            {interpret.kind === "loading" ? "Interpreting…" : "Interpret note"}
          </button>
        </div>

        {interpret.kind === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {interpret.message}
          </p>
        )}

        {interpret.kind === "done" && (
          <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            {interpret.result.changes.length === 0 && (
              <p className="text-sm text-zinc-500">
                No contract changes identified.
              </p>
            )}
            {interpret.result.changes.map((c, i) => {
              const target = overrideTarget(c.targetId);
              return (
                <label key={i} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={picked.has(i)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(i);
                      else next.delete(i);
                      setPicked(next);
                    }}
                  />
                  <span>
                    <span className="font-medium">
                      {c.label}
                      {target ? ` (TREC ${target.ref})` : ""}
                    </span>
                    {": "}
                    {c.interpretation}
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      default {target?.specDefault ?? "—"} → “{c.newValue}” ·
                      from “{c.quote}”
                    </span>
                  </span>
                </label>
              );
            })}

            {interpret.result.unmapped.length > 0 && (
              <div className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Not applied automatically:
                <ul className="ml-4 list-disc">
                  {interpret.result.unmapped.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {interpret.result.changes.length > 0 && (
              <button
                type="button"
                onClick={applyPicked}
                disabled={picked.size === 0}
                className="self-start rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Apply {picked.size} change{picked.size === 1 ? "" : "s"}
              </button>
            )}
          </div>
        )}

        {overrides.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500">
              Active overrides for this deal
            </p>
            {overrides.map((o) => {
              const target = overrideTarget(o.targetId);
              return (
                <div
                  key={o.targetId}
                  className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"
                >
                  <span>
                    <span className="font-medium">
                      {o.label}
                      {target ? ` (TREC ${target.ref})` : ""}
                    </span>
                    {": "}“{o.newValue}”
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOverride(o.targetId)}
                    className="text-xs text-zinc-500 hover:text-red-600"
                  >
                    remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">
            What can an override change?
          </summary>
          <ul className="mt-1 ml-4 list-disc">
            {OVERRIDE_TARGETS.map((t) => (
              <li key={t.id}>
                {t.label} (TREC {t.ref}) — default: {t.specDefault}
              </li>
            ))}
          </ul>
        </details>
      </Section>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className={inputCls}
      value={value || ""}
      onChange={(e) => onChange(Math.max(0, e.target.valueAsNumber || 0))}
    />
  );
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
