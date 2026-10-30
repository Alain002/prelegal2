import type { NdaDocument, NdaTemplate, NdaValues, Party } from "./types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Formats an ISO date (yyyy-mm-dd) as "October 26, 2026" without timezone shifts.
 * Returns "" for anything that isn't a real calendar date.
 */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  // Round-trip through UTC to reject dates such as 2026-02-30 or 2026-13-01.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${MONTHS[month - 1]} ${day}, ${match[1]}`;
}

function years(count: number): string {
  return `${count} ${count === 1 ? "year" : "years"}`;
}

/** Returns the trimmed value, or a bracketed placeholder when it is blank. */
function orPlaceholder(value: string, placeholder: string): string {
  return value.trim() || `[${placeholder}]`;
}

/** Combines the templates and the user's answers into a completed agreement. */
export function buildNda(values: NdaValues, template: NdaTemplate): NdaDocument {
  const { mndaTerm, confidentialityTerm, parties } = values;

  const mndaTermLine =
    mndaTerm.kind === "expires"
      ? `Expires ${years(mndaTerm.years)} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";

  const confidentialityLine =
    confidentialityTerm.kind === "years"
      ? `${years(confidentialityTerm.years)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  const partyValues = (pick: (party: Party) => string) => parties.map((p) => pick(p).trim());
  const blank = parties.map(() => "");

  return {
    title: "Mutual Non-Disclosure Agreement",
    coverIntro: template.coverIntro,
    coverFields: [
      {
        heading: "Purpose",
        hint: "How Confidential Information may be used",
        lines: [orPlaceholder(values.purpose, "Purpose")],
      },
      {
        heading: "Effective Date",
        lines: [formatDate(values.effectiveDate) || "[Effective Date]"],
      },
      { heading: "MNDA Term", hint: "The length of this MNDA", lines: [mndaTermLine] },
      {
        heading: "Term of Confidentiality",
        hint: "How long Confidential Information is protected",
        lines: [confidentialityLine],
      },
      {
        heading: "Governing Law & Jurisdiction",
        lines: [
          `Governing Law: ${orPlaceholder(values.governingLaw, "Governing Law")}`,
          `Jurisdiction: ${orPlaceholder(values.jurisdiction, "Jurisdiction")}`,
        ],
      },
      {
        heading: "MNDA Modifications",
        lines: [values.modifications.trim() || "None."],
      },
    ],
    signingStatement:
      "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
    partyHeadings: parties.map((_, i) => `PARTY ${i + 1}`),
    signatureRows: [
      { label: "Signature", values: blank },
      { label: "Print Name", values: partyValues((p) => p.name) },
      { label: "Title", values: partyValues((p) => p.title) },
      { label: "Company", values: partyValues((p) => p.company) },
      { label: "Notice Address", hint: "Use either email or postal address", values: partyValues((p) => p.noticeAddress) },
      { label: "Date", values: blank },
    ],
    clauses: template.clauses,
    // The licence asks adaptations to say what changed.
    attribution: [...template.attribution, { kind: "text", text: ` ${NDA_CHANGES}` }],
  };
}

export const NDA_CHANGES = "Changes: Prelegal filled in the Cover Page and reformatted the document.";

/** Builds a safe download filename such as "Mutual-NDA-Acme-Globex". */
export function ndaFileName(values: NdaValues): string {
  const companies = values.parties
    .map((p) => p.company.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
  return ["Mutual-NDA", ...companies].join("-");
}
