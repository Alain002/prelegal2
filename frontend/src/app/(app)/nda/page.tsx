import type { Metadata } from "next";
import { NdaCreator } from "@/components/NdaCreator";
import { loadNdaTemplate } from "@/lib/nda/loadTemplate";

export const metadata: Metadata = {
  title: "Mutual NDA Creator | Prelegal",
  description: "Create a Common Paper Mutual Non-Disclosure Agreement and download it as PDF or Word.",
};

// Read once at module scope: the templates are static files, so the page prerenders.
const template = loadNdaTemplate();

export default function NdaPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 print:p-0">
      <header className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-brand-navy">Mutual NDA Creator</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Chat with the AI assistant to create a Mutual Non-Disclosure Agreement based on the Common Paper
          standard. It asks about the details and fills in the agreement as you answer.
        </p>
      </header>
      <NdaCreator template={template} />
    </main>
  );
}
