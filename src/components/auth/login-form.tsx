"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus({ kind: "sending" });
    const supabase = createClient();

    // Use the actual origin the user is on — works on localhost, the staging
    // branch URL, and production without any per-environment config. Supabase
    // just needs the origin in its allowed Redirect URLs.
    const redirectPath = next && next.startsWith("/") ? next : "/lookup";
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      redirectPath,
    )}`;

    // shouldCreateUser: false — accounts are provisioned in the Supabase
    // dashboard (see supabase/README.md). Only known users get a link; the
    // /auth/callback route re-checks the allowlist regardless.
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo, shouldCreateUser: false },
    });

    if (error) {
      setStatus({ kind: "error", message: error.message });
    } else {
      setStatus({ kind: "sent" });
    }
  }

  if (status.kind === "sent") {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        Check <span className="font-medium">{email}</span> for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="you@example.com"
        />
      </label>
      {status.kind === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
      >
        {status.kind === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
