/** A run of inline text inside a paragraph. */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  /** A reference to a term defined on the Cover Page, e.g. "Purpose". */
  | { kind: "term"; text: string }
  | { kind: "link"; text: string; href: string };

/** One numbered clause of the Standard Terms. */
export interface Clause {
  number: number;
  title: string;
  body: Inline[];
}

/** The parsed Mutual NDA templates. */
export interface NdaTemplate {
  /** "Using this MNDA" paragraph from the Cover Page template. */
  coverIntro: Inline[];
  clauses: Clause[];
  /** License / attribution line at the end of the Standard Terms. */
  attribution: Inline[];
}

export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

/** Everything the user fills in on the form. */
export interface NdaValues {
  purpose: string;
  /** ISO date (yyyy-mm-dd), or "" when not chosen yet. */
  effectiveDate: string;
  mndaTerm: { kind: "expires"; years: number } | { kind: "untilTerminated" };
  confidentialityTerm: { kind: "years"; years: number } | { kind: "perpetual" };
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [Party, Party];
}

/** A labelled entry on the Cover Page. */
export interface CoverField {
  heading: string;
  hint?: string;
  lines: string[];
}

/** A row of the signature table: a label plus one value per party. */
export interface SignatureRow {
  label: string;
  hint?: string;
  values: string[];
}

/** The completed agreement, ready to be rendered in any format. */
export interface NdaDocument {
  title: string;
  coverIntro: Inline[];
  coverFields: CoverField[];
  signingStatement: string;
  signatureRows: SignatureRow[];
  clauses: Clause[];
  attribution: Inline[];
}
