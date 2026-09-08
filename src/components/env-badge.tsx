import { clientEnv, isProduction } from "@/lib/env";

/**
 * Fixed-corner badge showing which environment the running app is.
 * Hidden in production so real users never see it; visible on local and staging
 * so a change can be confirmed on staging before promotion.
 */
export function EnvBadge() {
  if (isProduction) return null;

  const label = clientEnv.APP_ENV.toUpperCase();
  const color =
    clientEnv.APP_ENV === "staging"
      ? "bg-amber-500 text-black"
      : "bg-sky-500 text-white";

  return (
    <div
      className={`fixed right-3 bottom-3 z-50 rounded-full px-3 py-1 text-xs font-semibold shadow-lg ${color}`}
      title={`Supabase: ${clientEnv.NEXT_PUBLIC_SUPABASE_URL}`}
    >
      {label}
    </div>
  );
}
