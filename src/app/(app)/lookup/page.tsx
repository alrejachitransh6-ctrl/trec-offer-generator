import { LegalLookupForm } from "@/components/lookup/legal-lookup-form";

export const metadata = { title: "Legal description lookup" };

export default function LookupPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Legal description lookup</h1>
        <p className="text-sm text-zinc-500">
          Enter a property address. We look it up on the county appraisal
          district site and pull the legal description — you confirm it before
          it&apos;s used anywhere.
        </p>
      </div>
      <LegalLookupForm />
    </main>
  );
}
