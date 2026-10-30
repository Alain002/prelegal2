import type { Metadata } from "next";
import { DocumentList } from "@/components/DocumentList";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
  title: "My documents | Prelegal",
};

export default function DocumentsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-navy">My documents</h1>
          <p className="mt-2 text-neutral-600">Your drafts, saved after every message. Open one to keep editing or download it.</p>
        </div>
        <ButtonLink href="/draft/">Start a new document</ButtonLink>
      </header>
      <DocumentList />
    </main>
  );
}
