import { LoginForm } from "@/components/auth/login-form";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That email address isn't authorized for this app.",
  link_invalid:
    "That sign-in link is invalid or has expired. Request a new one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-zinc-500">
          Enter your email and we&apos;ll send you a sign-in link.
        </p>
      </div>
      {error && ERROR_MESSAGES[error] && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {ERROR_MESSAGES[error]}
        </p>
      )}
      <LoginForm next={next} />
    </main>
  );
}
