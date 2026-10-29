"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNda, ndaFileName } from "@/lib/nda/buildNda";
import { defaultNdaValues, todayIso } from "@/lib/nda/defaults";
import type { NdaTemplate, NdaValues } from "@/lib/nda/types";
import { Chat } from "./Chat";
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
  "rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors disabled:cursor-wait disabled:opacity-60";

export function NdaCreator({ template }: { template: NdaTemplate }) {
  const [values, setValues] = useState<NdaValues>(defaultNdaValues);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default the Effective Date to today. Done after mount so the prerendered
  // page does not depend on the build date.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((v) => (v.effectiveDate ? v : { ...v, effectiveDate: todayIso() }));
  }, []);

  const nda = useMemo(() => buildNda(values, template), [values, template]);

  async function downloadWord() {
    setExporting(true);
    setError(null);
    try {
      // Loaded on demand to keep the docx library out of the initial bundle.
      const { toDocx } = await import("@/lib/nda/toDocx");
      downloadBlob(await toDocx(nda), `${ndaFileName(values)}.docx`);
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
            className={`${buttonClass} bg-brand-purple text-white hover:bg-brand-purple/90`}
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={downloadWord}
            disabled={exporting}
            className={`${buttonClass} bg-white text-neutral-900 ring-1 ring-neutral-300 hover:bg-neutral-50`}
          >
            {exporting ? "Preparing…" : "Download Word"}
          </button>
        </div>
        <p className="text-xs text-neutral-600">
          Download PDF opens your browser&apos;s print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <Chat values={values} onValues={setValues} />
      </aside>

      <section aria-label="Agreement preview">
        <NdaPreview nda={nda} />
      </section>
    </div>
  );
}
