import { AlignmentType, Paragraph, TextRun } from "docx";
import { agreementDocx, runs } from "@/lib/docx";
import type { NdaDocument } from "./types";

/** Renders the completed NDA as a Word document. */
export function toDocx(nda: NdaDocument): Promise<Blob> {
  const clauses = nda.clauses.map(
    (clause) =>
      new Paragraph({
        spacing: { after: 160 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: `${clause.number}. ${clause.title}. `, bold: true }), ...runs(clause.body)],
      }),
  );
  return agreementDocx(nda, clauses);
}
