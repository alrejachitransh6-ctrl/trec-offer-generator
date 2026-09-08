import Link from "next/link";

import { requireUser } from "@/lib/supabase/auth";
import { siteConfig } from "@/config/site";

/**
 * Layout for all authenticated routes. `requireUser()` redirects to `/login`
 * when there is no allowlisted session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <Link href="/lookup" className="text-sm font-semibold">
            {siteConfig.name}
          </Link>
          <Link href="/deals" className="text-sm text-zinc-500 hover:underline">
            Deals
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="hidden sm:inline">{user.email}</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
