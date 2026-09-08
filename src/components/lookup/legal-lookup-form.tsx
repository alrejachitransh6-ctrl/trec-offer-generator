"use client";

import { useState } from "react";

import { COUNTY_META } from "@/lib/counties/list";
import type {
  CountyId,
  LegalDescription,
  LegalLookupResponse,
} from "@/lib/validations/legal-lookup";

type RequestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; response: LegalLookupResponse }
  | { kind: "error"; message: string };

interface EditableLegal {
  legalDescription: string;
  lot: string;
  block: string;
  addition: string;
  city: string;
}

const EMPTY_EDITABLE: EditableLegal = {
  legalDescription: "",
  lot: "",
  block: "",
  addition: "",
  city: "",
};

function toEditable(l: LegalDescription | null): EditableLegal {
  if (!l) return EMPTY_EDITABLE;
  return {
    legalDescription: l.legalDescription ?? "",
    lot: l.lot ?? "",
    block: l.block ?? "",
    addition: l.addition ?? "",
    city: l.city ?? "",
  };
}

export function LegalLookupForm() {
  const [address, setAddress] = useState("");
  const [countyId, setCountyId] = useState<CountyId>("dallas");
  const [state, setState] = useState<RequestState>({ kind: "idle" });
  const [editable, setEditable] = useState<EditableLegal>(EMPTY_EDITABLE);
  const [confirmed, setConfirmed] = useState<
    (EditableLegal & { countyId: CountyId }) | null
  >(null);
  const [showContext, setShowContext] = useState(false);

  async function runLookup(event: React.FormEvent) {
    event.preventDefault();
    setState({ kind: "loading" });
    setConfirmed(null);
    try {
      const res = await fetch("/api/legal-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), countyId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: body.error ?? `Request failed (${res.status})`,
        });
        return;
      }
      const response: LegalLookupResponse = await res.json();
      setEditable(toEditable(response.extracted));
      setState({ kind: "done", response });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  const county = COUNTY_META.find((c) => c.id === countyId)!;
  const response = state.kind === "done" ? state.response : null;
  const confidence = response?.extracted?.confidence ?? null;
  const needsReview =
    response != null &&
    (!response.supported ||
      response.error != null ||
      confidence == null ||
      confidence !== "high");

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={runLookup} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Property address
          </span>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="1121 Angie Ln"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">County</span>
          <select
            value={countyId}
            onChange={(e) => setCountyId(e.target.value as CountyId)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {COUNTY_META.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.autoLookup ? "" : " (manual entry)"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={state.kind === "loading"}
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {state.kind === "loading"
            ? "Looking up…"
            : "Look up legal description"}
        </button>
      </form>

      {state.kind === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </p>
      )}

      {response && (
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {!response.supported && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Automatic lookup for {county.label} County isn&apos;t available
              yet. Find the property on{" "}
              <a
                href={county.cadUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {county.cadName}
              </a>{" "}
              and enter the legal description below.
            </p>
          )}

          {response.error && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {response.error}
            </p>
          )}

          {response.supported && !response.error && confidence && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-semibold " +
                  (confidence === "high"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300")
                }
              >
                {confidence} confidence
              </span>
              {response.sourceUrl && (
                <a
                  href={response.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-500 underline"
                >
                  View source page
                </a>
              )}
            </div>
          )}

          {needsReview && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Review carefully before confirming — this needs a human check.
            </p>
          )}

          {response.extracted?.notes && (
            <p className="text-sm text-zinc-500">{response.extracted.notes}</p>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Legal description
            </span>
            <textarea
              rows={3}
              value={editable.legalDescription}
              onChange={(e) =>
                setEditable((s) => ({
                  ...s,
                  legalDescription: e.target.value,
                }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["lot", "block", "addition", "city"] as const).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 capitalize dark:text-zinc-400">
                  {field}
                </span>
                <input
                  value={editable[field]}
                  onChange={(e) =>
                    setEditable((s) => ({ ...s, [field]: e.target.value }))
                  }
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            ))}
          </div>

          {response.pageContext && (
            <div>
              <button
                type="button"
                onClick={() => setShowContext((v) => !v)}
                className="text-xs text-zinc-500 underline"
              >
                {showContext ? "Hide" : "Show"} what the lookup read
              </button>
              {showContext && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {response.pageContext}
                </pre>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!editable.legalDescription.trim()}
              onClick={() => setConfirmed({ ...editable, countyId })}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm legal description
            </button>
            {confirmed && (
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Confirmed ✓
              </span>
            )}
          </div>
        </section>
      )}

      {confirmed && (
        <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-800 dark:text-emerald-300">
            Confirmed legal description
          </p>
          <p className="mt-1 font-mono text-emerald-900 dark:text-emerald-200">
            {confirmed.legalDescription}
          </p>
          <p className="mt-2 text-emerald-700 dark:text-emerald-400">
            Lot {confirmed.lot || "—"} · Block {confirmed.block || "—"} ·{" "}
            {confirmed.addition || "—"} · {confirmed.city || "—"}
          </p>
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-500">
            (Next step — carrying this into a saved deal — is a later slice.)
          </p>
        </section>
      )}
    </div>
  );
}
