import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { DISCLAIMER, DISCLAIMER_HEADING, DISCLAIMER_SHORT } from "@/lib/disclaimer";
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

/** The boxed "draft, subject to legal review" notice under the title. */
function disclaimerNotice() {
  const border = { style: BorderStyle.SINGLE, size: 6, color: "666666", space: 6 };
  const borders = { top: border, bottom: border, left: border, right: border };
  return [
    new Paragraph({ border: borders, children: [new TextRun({ text: DISCLAIMER_HEADING.toUpperCase(), bold: true, size: 20 })] }),
    new Paragraph({ border: borders, spacing: { after: 300 }, children: [new TextRun({ text: DISCLAIMER, size: 20 })] }),
  ];
}

/** The same notice, short, at the foot of every page. */
function disclaimerFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: DISCLAIMER_SHORT, italics: true, size: 16, color: "555555" })],
      }),
    ],
  });
}

/**
 * Renders a completed agreement as a Word document: the cover page, then the Standard Terms
 * (`terms`, which differ between the NDA and the other documents) in a second section, so they
 * start on a new page.
 */
export function agreementDocx(doc: CoverPage, terms: Paragraph[]): Promise<Blob> {
  const footers = { default: disclaimerFooter() };
  const word = new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [
      {
        footers,
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, text: doc.title }),
          ...disclaimerNotice(),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Cover Page" }),
          new Paragraph({ children: runs(doc.coverIntro), spacing: { after: 200 } }),
          ...coverFieldParagraphs(doc.coverFields),
          new Paragraph({ text: doc.signingStatement, spacing: { before: 300, after: 200 } }),
          signatureTable(doc.partyHeadings, doc.signatureRows),
        ],
      },
      {
        footers,
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
