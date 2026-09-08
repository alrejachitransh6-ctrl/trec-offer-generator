"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "magic";

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

const inputCls =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const redirectPath = next && next.startsWith("/") ? next : "/lookup";

  async function signInPassword(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !password) return;
    setStatus({ kind: "working" });

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    router.replace(redirectPath);
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus({ kind: "working" });

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
      redirectPath,
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo, shouldCreateUser: false },
    });
    setStatus(
      error ? { kind: "error", message: error.message } : { kind: "sent" },
    );
  }

  if (status.kind === "sent") {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        Check <span className="font-medium">{email}</span> for a sign-in link.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={mode === "password" ? signInPassword : sendMagicLink}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
        </label>

        {mode === "password" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>
        )}

        {status.kind === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={status.kind === "working"}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {status.kind === "working"
            ? "…"
            : mode === "password"
              ? "Sign in"
              : "Send sign-in link"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "password" ? "magic" : "password");
          setStatus({ kind: "idle" });
        }}
        className="self-start text-xs text-zinc-500 underline"
      >
        {mode === "password"
          ? "Email me a sign-in link instead"
          : "Use a password instead"}
      </button>
    </div>
  );
}
