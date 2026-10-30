import type { CoverField, Inline, SignatureRow } from "@/lib/nda/types";

/**
 * The agreement being drafted, as the AI fills it in. Mirrors Draft in backend/app/documents/drafts.py.
 * Field values are plain strings keyed by field key (see documents.json); a missing key means blank.
 */
export interface Draft {
  documentId: string | null;
  fields: Record<string, string>;
}

/** One field of a document, from documents.json. */
export interface DocumentField {
  key: string;
  label: string;
  kind?: "text" | "date" | "term";
  essential?: boolean;
  openEnded?: string;
}

/** A clause of the Standard Terms, with its sub-clauses. */
export interface TermNode {
  /** The number as printed: "1.", "1.1", "(a)" or "(i)". */
  label: string;
  /** The clause title, e.g. "Access and Use."; empty when the clause has none. */
  heading: Inline[];
  body: Inline[];
  children: TermNode[];
}

/** A document Prelegal can draft, as the page needs it. */
export interface DocumentInfo {
  id: string;
  name: string;
  /** The start of the download file name, e.g. "Pilot-Agreement". */
  fileName: string;
  parties: [string, string];
  fields: DocumentField[];
  /** The parsed Standard Terms. null for the Mutual NDA, which has its own templates. */
  terms: TermNode[] | null;
}

/** What every completed agreement has around its Standard Terms: the NDA's and the others'. */
export interface CoverPage {
  title: string;
  coverIntro: Inline[];
  coverFields: CoverField[];
  signingStatement: string;
  /** Column headings of the signature table, e.g. ["PROVIDER", "CUSTOMER"]. */
  partyHeadings: string[];
  signatureRows: SignatureRow[];
  attribution: Inline[];
}

/** A completed agreement other than the NDA, ready to be rendered in any format. */
export interface AgreementDocument extends CoverPage {
  terms: TermNode[];
}

/** The Mutual NDA's id in documents.json. It keeps its own cover page, preview and Word export. */
export const NDA_ID = "mutual-nda";
