"use client";

import { useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/chat/api";
import { buildDocument, documentFileName, toNdaValues } from "@/lib/documents/buildDocument";
import { NDA_ID, type DocumentInfo, type Draft } from "@/lib/documents/types";
import { buildNda, ndaFileName } from "@/lib/nda/buildNda";
import type { NdaTemplate } from "@/lib/nda/types";
import { useAutosave, type SaveStatus } from "@/lib/saved/useAutosave";
import { Chat } from "./Chat";
import { DocumentPreview } from "./DocumentPreview";
import { NdaPreview } from "./NdaPreview";
import { Alert, Button, cx, EmptyState } from "./ui";

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
    <EmptyState title="Your agreement will appear here" className="mx-auto max-w-[8.5in]">
      <p className="mt-2">
        Tell the assistant what you need and it will pick the right document. Prelegal can draft:
      </p>
      <ul className="mt-4 grid list-disc gap-x-8 gap-y-1 pl-5 sm:grid-cols-2">
        {documents.map((d) => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
    </EmptyState>
  );
}

/** A saved document to carry on with: its id, draft and conversation. */
export type SavedStart = { id: number; draft: Draft; messages: ChatMessage[] };

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: "Saved automatically once the assistant picks your document.",
  saving: "Saving…",
  saved: "All changes saved to My documents.",
  error: "Couldn't save your latest changes.",
};

const SAVE_DOTS: Record<SaveStatus, string> = {
  idle: "bg-neutral-300",
  saving: "animate-pulse bg-neutral-400",
  saved: "bg-green-600",
  error: "bg-red-600",
};

export function DraftCreator({
  documents,
  ndaTemplate,
  saved,
  onCreated,
}: {
  documents: DocumentInfo[];
  ndaTemplate: NdaTemplate;
  saved?: SavedStart;
  /** Told the new document's id when a new draft is first saved. */
  onCreated?: (id: number) => void;
}) {
  const [draft, setDraft] = useState<Draft>(saved?.draft ?? { documentId: null, fields: {} });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosave = useAutosave(saved?.id ?? null, onCreated);

  const info = documents.find((d) => d.id === draft.documentId);
  const rendered = useMemo(() => info && render(info, draft, ndaTemplate), [info, draft, ndaTemplate]);

  function handleTurn(next: Draft, messages: ChatMessage[]) {
    setDraft(next);
    autosave.save(next, messages);
  }

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
      <aside className="flex flex-col gap-3 print:hidden lg:sticky lg:top-6 lg:h-[calc(100vh-13.5rem)] lg:min-h-[24rem]">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()} disabled={!rendered}>
            Download PDF
          </Button>
          <Button variant="secondary" onClick={downloadWord} disabled={!rendered || exporting}>
            {exporting ? "Preparing…" : "Download Word"}
          </Button>
        </div>
        <p className="text-xs text-neutral-600">
          {rendered
            ? "Download PDF opens your browser's print dialog. Choose “Save as PDF” as the destination."
            : "The downloads are ready once the assistant has picked your document."}
        </p>
        <div role="status" className="flex items-center gap-2 text-xs text-neutral-600" data-testid="save-status">
          <span aria-hidden className={cx("size-2 shrink-0 rounded-full", SAVE_DOTS[autosave.status])} />
          <span className={autosave.status === "error" ? "text-red-800" : undefined}>{SAVE_LABELS[autosave.status]}</span>
          {autosave.status === "error" && (
            <button type="button" onClick={autosave.retry} className="font-semibold text-red-800 underline">
              Try again
            </button>
          )}
        </div>
        {error && <Alert>{error}</Alert>}
        <Chat draft={draft} onTurn={handleTurn} initialMessages={saved?.messages} />
      </aside>

      <section aria-label="Agreement preview">{rendered ? rendered.preview : <Start documents={documents} />}</section>
    </div>
  );
}
