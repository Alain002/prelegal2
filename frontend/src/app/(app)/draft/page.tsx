import type { Metadata } from "next";
import { DraftCreator } from "@/components/DraftCreator";
import { loadDocuments } from "@/lib/documents/loadDocuments";
import { loadNdaTemplate } from "@/lib/nda/loadTemplate";

export const metadata: Metadata = {
  title: "Draft an agreement | Prelegal",
  description: "Draft a Common Paper legal agreement by chatting with an AI assistant, and download it as PDF or Word.",
};

// Read once at module scope: the templates are static files, so the page prerenders.
const documents = loadDocuments();
const ndaTemplate = loadNdaTemplate();

export default function DraftPage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 print:p-0">
      <header className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold text-brand-navy">Draft an agreement</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Tell the AI assistant what you need. It picks the right Common Paper agreement, asks about the details
          and fills it in as you answer.
        </p>
      </header>
      <DraftCreator documents={documents} ndaTemplate={ndaTemplate} />
    </main>
  );
}
