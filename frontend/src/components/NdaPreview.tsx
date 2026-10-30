import type { NdaDocument } from "@/lib/nda/types";
import { AgreementPage, InlineText } from "./DocumentParts";

/** The completed NDA: its cover page and its 11 flat Standard Terms clauses. */
export function NdaPreview({ nda }: { nda: NdaDocument }) {
  return (
    <AgreementPage doc={nda}>
      <ol className="space-y-3 text-justify">
        {nda.clauses.map((clause) => (
          <li key={clause.number}>
            <strong>
              {clause.number}. {clause.title}.
            </strong>{" "}
            <InlineText inlines={clause.body} />
          </li>
        ))}
      </ol>
    </AgreementPage>
  );
}
