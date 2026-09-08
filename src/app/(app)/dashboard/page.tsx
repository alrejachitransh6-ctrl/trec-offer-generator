/**
 * Placeholder authenticated dashboard. Establishes the `(app)` route group for
 * signed-in views. Route protection is added in `src/lib/supabase/middleware.ts`.
 */
export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-2 p-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-zinc-500">Nothing here yet.</p>
    </main>
  );
}
