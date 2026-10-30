import { formatDate } from "@/lib/nda/buildNda";
import type { Inline, NdaValues } from "@/lib/nda/types";
import type { AgreementDocument, DocumentField, DocumentInfo, Draft } from "./types";

type PartyDetail = "Company" | "Name" | "Title" | "NoticeAddress";

/** A party's detail, e.g. party(fields, 1, "Company") reads "party1Company". */
function party(fields: Draft["fields"], n: 1 | 2, detail: PartyDetail): string {
  return (fields[`party${n}${detail}`] ?? "").trim();
}

/** What a key term shows: the answer, "None" for a skipped optional term, or a [placeholder]. */
function keyTermValue(field: DocumentField, value: string): string {
  if (field.kind === "date") value = formatDate(value);
  if (value) return value;
  return field.essential ? `[${field.label}]` : "None";
}

/** Combines a document's Standard Terms with the draft into a completed agreement (any document but the NDA). */
export function buildDocument(info: DocumentInfo, draft: Draft): AgreementDocument {
  const { fields } = draft;
  const roles = info.parties;
  const effectiveDate = info.fields.find((f) => f.key === "effectiveDate")?.label ?? "Effective Date";
  const both = (pick: (n: 1 | 2) => string) => [pick(1), pick(2)];

  return {
    title: info.name,
    coverIntro: [
      {
        kind: "text",
        text:
          `This Cover Page sets out the Key Terms of the ${info.name} between the parties named below. ` +
          "Together with the Standard Terms that follow, it forms the agreement. Capitalized terms used in the " +
          "Standard Terms, such as those listed here, have the meanings given on this Cover Page.",
      },
    ],
    coverFields: [
      {
        heading: "Parties",
        lines: both((n) => `${roles[n - 1]}: ${party(fields, n, "Company") || `[${roles[n - 1]}]`}`),
      },
      ...info.fields.map((field) => ({
        heading: field.label,
        lines: [keyTermValue(field, (fields[field.key] ?? "").trim())],
      })),
    ],
    signingStatement: `By signing this Cover Page, each party agrees to enter into this ${info.name} as of the ${effectiveDate}.`,
    partyHeadings: roles.map((role) => role.toUpperCase()),
    signatureRows: [
      { label: "Signature", values: ["", ""] },
      { label: "Print Name", values: both((n) => party(fields, n, "Name")) },
      { label: "Title", values: both((n) => party(fields, n, "Title")) },
      { label: "Company", values: both((n) => party(fields, n, "Company")) },
      { label: "Notice Address", hint: "Use either email or postal address", values: both((n) => party(fields, n, "NoticeAddress")) },
      { label: "Date", values: ["", ""] },
    ],
    terms: info.terms ?? [],
    attribution: attribution(info.name),
  };
}

/** Common Paper's licence asks for credit, and for adaptations to say what changed. */
function attribution(name: string): Inline[] {
  return [
    { kind: "text", text: "Adapted by Prelegal from the " },
    { kind: "link", text: "Common Paper", href: "https://commonpaper.com/standards/" },
    { kind: "text", text: ` ${name}, free to use under ` },
    { kind: "link", text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
    { kind: "text", text: ". Changes: Prelegal added this Cover Page and reformatted the Standard Terms." },
  ];
}

/** Builds a safe download file name such as "Pilot-Agreement-Acme-Globex". */
export function documentFileName(info: DocumentInfo, draft: Draft): string {
  const companies = ([1, 2] as const)
    .map((n) => party(draft.fields, n, "Company").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);
  return [info.fileName, ...companies].join("-");
}

/**
 * The NDA draft in the shape the NDA's own cover page, preview and Word export use. The backend
 * stores each term as a number of years or as its open-ended choice ("until terminated",
 * "perpetual"), so anything that isn't a number is the open-ended choice.
 */
export function toNdaValues(fields: Draft["fields"]): NdaValues {
  const text = (key: string) => fields[key] ?? "";
  const years = (key: string) => Number.parseInt(text(key), 10) || null;
  const mndaYears = years("mndaTerm");
  const confidentialityYears = years("confidentialityTerm");
  const partyValues = (n: 1 | 2) => ({
    company: text(`party${n}Company`),
    name: text(`party${n}Name`),
    title: text(`party${n}Title`),
    noticeAddress: text(`party${n}NoticeAddress`),
  });
  return {
    purpose: text("purpose"),
    effectiveDate: text("effectiveDate"),
    mndaTerm: mndaYears || !fields.mndaTerm ? { kind: "expires", years: mndaYears ?? 1 } : { kind: "untilTerminated" },
    confidentialityTerm:
      confidentialityYears || !fields.confidentialityTerm
        ? { kind: "years", years: confidentialityYears ?? 1 }
        : { kind: "perpetual" },
    governingLaw: text("governingLaw"),
    jurisdiction: text("chosenCourts"),
    modifications: text("modifications"),
    parties: [partyValues(1), partyValues(2)],
  };
}
