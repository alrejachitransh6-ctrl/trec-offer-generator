import { siteConfig } from "@/config/site";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {siteConfig.name}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {siteConfig.description}
      </p>
      <p className="text-sm text-zinc-500">
        Project scaffold — Next.js, Supabase, and pdf-lib are wired up. Feature
        work starts from here.
      </p>
    </main>
  );
}
