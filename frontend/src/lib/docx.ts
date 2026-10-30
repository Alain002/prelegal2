import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { CoverPage } from "@/lib/documents/types";
import type { CoverField, Inline, SignatureRow } from "@/lib/nda/types";

/** Word building blocks shared by the NDA's export and the other documents'. */

export function runs(inlines: Inline[]) {
  return inlines.map((inline) => {
    switch (inline.kind) {
      case "bold":
      case "term":
        return new TextRun({ text: inline.text, bold: true });
      case "link":
        return new ExternalHyperlink({
          link: inline.href,
          children: [new TextRun({ text: inline.text, style: "Hyperlink" })],
        });
      default:
        return new TextRun(inline.text);
    }
  });
}

/** Plain text runs that keep the user's line breaks (Word ignores raw "\n"). */
function lines(text: string, bold = false) {
  return text.split(/\r?\n/).map((line, i) => new TextRun({ text: line, bold, break: i > 0 ? 1 : 0 }));
}

function cell(text: string, { bold = false } = {}) {
  return new TableCell({ children: [new Paragraph({ children: lines(text, bold) })] });
}

/** The Cover Page's labelled entries. */
function coverFieldParagraphs(fields: CoverField[]) {
  return fields.flatMap((field) => [
    new Paragraph({ heading: HeadingLevel.HEADING_3, text: field.heading }),
    ...(field.hint
      ? [new Paragraph({ children: [new TextRun({ text: field.hint, italics: true, size: 18 })] })]
      : []),
    ...field.lines.map((line) => new Paragraph({ children: lines(line) })),
  ]);
}

/** The signature table: a label column, then one column per party. */
function signatureTable(headings: string[], rows: SignatureRow[]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        children: [cell(""), ...headings.map((heading) => cell(heading, { bold: true }))],
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            height: { value: 500, rule: "atLeast" },
            children: [cell(row.label, { bold: true }), ...row.values.map((value) => cell(value))],
          }),
      ),
    ],
  });
}

/**
 * Renders a completed agreement as a Word document: the cover page, then the Standard Terms
 * (`terms`, which differ between the NDA and the other documents) in a second section, so they
 * start on a new page.
 */
export function agreementDocx(doc: CoverPage, terms: Paragraph[]): Promise<Blob> {
  const word = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, text: doc.title }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Cover Page" }),
          new Paragraph({ children: runs(doc.coverIntro), spacing: { after: 200 } }),
          ...coverFieldParagraphs(doc.coverFields),
          new Paragraph({ text: doc.signingStatement, spacing: { before: 300, after: 200 } }),
          signatureTable(doc.partyHeadings, doc.signatureRows),
        ],
      },
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Standard Terms" }),
          ...terms,
          new Paragraph({ children: runs(doc.attribution), spacing: { before: 300 } }),
        ],
      },
    ],
  });
  return Packer.toBlob(word);
}
