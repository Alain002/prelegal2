"use client";

import { useEffect, useMemo, useState } from "react";
import { buildNda, ndaFileName } from "@/lib/nda/buildNda";
import { defaultNdaValues, todayIso } from "@/lib/nda/defaults";
import type { NdaTemplate, NdaValues } from "@/lib/nda/types";
import { NdaForm } from "./NdaForm";
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
      <aside className="space-y-4 print:hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className={`${buttonClass} bg-blue-700 text-white hover:bg-blue-800`}
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
        <p className="text-xs text-neutral-500">
          Download PDF opens your browser&apos;s print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <NdaForm values={values} onChange={setValues} />
      </aside>

      <section aria-label="Agreement preview">
        <NdaPreview nda={nda} />
      </section>
    </div>
  );
}
