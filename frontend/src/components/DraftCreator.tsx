"use client";

import { useMemo, useState } from "react";
import { buildDocument, documentFileName, toNdaValues } from "@/lib/documents/buildDocument";
import { NDA_ID, type DocumentInfo, type Draft } from "@/lib/documents/types";
import { buildNda, ndaFileName } from "@/lib/nda/buildNda";
import type { NdaTemplate } from "@/lib/nda/types";
import { Chat } from "./Chat";
import { DocumentPreview } from "./DocumentPreview";
import { NdaPreview } from "./NdaPreview";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke later so browsers that start the download asynchronously still get the file.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const buttonClass =
  "rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/** The document as rendered from the draft: the NDA through its own templates, the others generically. */
function render(info: DocumentInfo, draft: Draft, ndaTemplate: NdaTemplate) {
  if (info.id === NDA_ID) {
    const values = toNdaValues(draft.fields);
    const nda = buildNda(values, ndaTemplate);
    return {
      preview: <NdaPreview nda={nda} />,
      fileName: ndaFileName(values),
      toWord: async () => (await import("@/lib/nda/toDocx")).toDocx(nda),
    };
  }
  const doc = buildDocument(info, draft);
  return {
    preview: <DocumentPreview doc={doc} />,
    fileName: documentFileName(info, draft),
    toWord: async () => (await import("@/lib/documents/toDocx")).documentToDocx(doc),
  };
}

/** Before a document is chosen: what the assistant can draft. */
function Start({ documents }: { documents: DocumentInfo[] }) {
  return (
    <div className="mx-auto max-w-[8.5in] rounded-lg border-2 border-dashed border-neutral-300 bg-white px-8 py-10 text-neutral-700">
      <h2 className="text-xl font-bold text-brand-navy">Your agreement will appear here</h2>
      <p className="mt-2">
        Tell the assistant what you need and it will pick the right document. Prelegal can draft:
      </p>
      <ul className="mt-4 grid list-disc gap-x-8 gap-y-1 pl-5 sm:grid-cols-2">
        {documents.map((d) => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
    </div>
  );
}

export function DraftCreator({ documents, ndaTemplate }: { documents: DocumentInfo[]; ndaTemplate: NdaTemplate }) {
  const [draft, setDraft] = useState<Draft>({ documentId: null, fields: {} });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = documents.find((d) => d.id === draft.documentId);
  const rendered = useMemo(() => info && render(info, draft, ndaTemplate), [info, draft, ndaTemplate]);

  async function downloadWord() {
    if (!rendered) return;
    setExporting(true);
    setError(null);
    try {
      // Loaded on demand to keep the docx library out of the initial bundle.
      downloadBlob(await rendered.toWord(), `${rendered.fileName}.docx`);
    } catch (e) {
      console.error(e);
      setError("Could not create the Word document. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(320px,420px)_1fr] print:block">
      {/* On desktop the column fits on screen below the page headers (about 13rem), so the message
          box is visible without scrolling; the conversation scrolls inside it. */}
      <aside className="flex flex-col gap-4 print:hidden lg:sticky lg:top-6 lg:h-[calc(100vh-13.5rem)] lg:min-h-[24rem]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!rendered}
            className={`${buttonClass} bg-brand-purple text-white hover:bg-brand-purple/90`}
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={downloadWord}
            disabled={!rendered || exporting}
            className={`${buttonClass} bg-white text-neutral-900 ring-1 ring-neutral-300 hover:bg-neutral-50`}
          >
            {exporting ? "Preparing…" : "Download Word"}
          </button>
        </div>
        <p className="text-xs text-neutral-600">
          {rendered
            ? "Download PDF opens your browser's print dialog. Choose “Save as PDF” as the destination."
            : "The downloads are ready once the assistant has picked your document."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Chat draft={draft} onDraft={setDraft} />
      </aside>

      <section aria-label="Agreement preview">{rendered ? rendered.preview : <Start documents={documents} />}</section>
    </div>
  );
}
