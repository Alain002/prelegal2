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
import type { Inline, NdaDocument } from "./types";

const FONT = "Times New Roman";

function runs(inlines: Inline[]) {
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

/** Renders the completed agreement as a Word document. */
export async function toDocx(nda: NdaDocument): Promise<Blob> {
  const coverFields = nda.coverFields.flatMap((field) => [
    new Paragraph({ heading: HeadingLevel.HEADING_3, text: field.heading }),
    ...(field.hint
      ? [new Paragraph({ children: [new TextRun({ text: field.hint, italics: true, size: 18 })] })]
      : []),
    ...field.lines.map((line) => new Paragraph({ children: lines(line) })),
  ]);

  const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({
        children: [cell(""), ...nda.signatureRows[0].values.map((_, i) => cell(`PARTY ${i + 1}`, { bold: true }))],
      }),
      ...nda.signatureRows.map(
        (row) =>
          new TableRow({
            height: { value: 500, rule: "atLeast" },
            children: [cell(row.label, { bold: true }), ...row.values.map((value) => cell(value))],
          }),
      ),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, text: nda.title }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Cover Page" }),
          new Paragraph({ children: runs(nda.coverIntro), spacing: { after: 200 } }),
          ...coverFields,
          new Paragraph({ text: nda.signingStatement, spacing: { before: 300, after: 200 } }),
          signatureTable,
        ],
      },
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Standard Terms" }),
          ...nda.clauses.map(
            (clause) =>
              new Paragraph({
                spacing: { after: 160 },
                alignment: AlignmentType.JUSTIFIED,
                children: [new TextRun({ text: `${clause.number}. ${clause.title}. `, bold: true }), ...runs(clause.body)],
              }),
          ),
          new Paragraph({ children: runs(nda.attribution), spacing: { before: 300 } }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
