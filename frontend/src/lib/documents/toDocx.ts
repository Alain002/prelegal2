import { AlignmentType, HeadingLevel, Paragraph, TextRun } from "docx";
import { agreementDocx, runs } from "@/lib/docx";
import type { Inline } from "@/lib/nda/types";
import type { AgreementDocument, TermNode } from "./types";

// Indent per nesting level, in twentieths of a point (360 = a quarter inch).
const INDENT = 360;

const bold = (inlines: Inline[]) => inlines.map((inline): Inline => (inline.kind === "text" ? { ...inline, kind: "bold" } : inline));

function clauseParagraphs(node: TermNode, depth: number): Paragraph[] {
  const label = new TextRun({ text: `${node.label} `, bold: true });
  const own =
    depth === 0
      ? [
          new Paragraph({ heading: HeadingLevel.HEADING_3, children: [label, ...runs(node.heading)] }),
          ...(node.body.length > 0 ? [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(node.body) })] : []),
        ]
      : [
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { left: INDENT * depth },
            spacing: { after: 120 },
            children: [
              label,
              ...runs(bold(node.heading)),
              ...(node.heading.length > 0 ? [new TextRun(" ")] : []),
              ...runs(node.body),
            ],
          }),
        ];
  return [...own, ...node.children.flatMap((child) => clauseParagraphs(child, depth + 1))];
}

/** Renders a completed agreement (any document but the NDA) as a Word document. */
export function documentToDocx(doc: AgreementDocument): Promise<Blob> {
  return agreementDocx(
    doc,
    doc.terms.flatMap((node) => clauseParagraphs(node, 0)),
  );
}
