import { describe, expect, it } from "vitest";
import { documentInfo, filledValues, ndaDraft, pilotDraft } from "@/test/fixtures";
import { buildDocument, documentFileName, toNdaValues } from "./buildDocument";
import type { Draft } from "./types";

const pilot = documentInfo("pilot");
const lines = (draft: Draft = pilotDraft) =>
  Object.fromEntries(buildDocument(pilot, draft).coverFields.map((field) => [field.heading, field.lines]));

describe("buildDocument", () => {
  it("lists the parties and every key term with its answer", () => {
    expect(lines()).toEqual({
      Parties: ["Provider: Acme Inc.", "Customer: Globex LLC"],
      "Effective Date": ["November 1, 2026"],
      Product: ["Acme Analytics"],
      "Pilot Period": ["90 days"],
      "General Cap Amount": ["$50,000"],
      "Governing Law": ["Delaware"],
      "Chosen Courts": ["courts located in Wilmington, Delaware"],
      Fees: ["None"],
    });
  });

  it("shows placeholders for missing essential terms and None for skipped optional ones", () => {
    expect(lines({ documentId: "pilot", fields: {} })).toMatchObject({
      Parties: ["Provider: [Provider]", "Customer: [Customer]"],
      "Effective Date": ["[Effective Date]"],
      "Pilot Period": ["[Pilot Period]"],
      Fees: ["None"],
    });
  });

  it("shows a placeholder for a date that isn't real", () => {
    expect(lines({ ...pilotDraft, fields: { ...pilotDraft.fields, effectiveDate: "2026-02-30" } })["Effective Date"]).toEqual(["[Effective Date]"]);
  });

  it("titles the agreement and its signature table with the document's roles", () => {
    const doc = buildDocument(pilot, pilotDraft);
    expect(doc.title).toBe("Pilot Agreement");
    expect(doc.coverIntro[0].text).toContain("Key Terms of the Pilot Agreement");
    expect(doc.signingStatement).toBe("By signing this Cover Page, each party agrees to enter into this Pilot Agreement as of the Effective Date.");
    expect(doc.partyHeadings).toEqual(["PROVIDER", "CUSTOMER"]);
    expect(doc.signatureRows.map((row) => [row.label, ...row.values])).toEqual([
      ["Signature", "", ""],
      ["Print Name", "Ada Lovelace", "Alan Turing"],
      ["Title", "", ""],
      ["Company", "Acme Inc.", "Globex LLC"],
      ["Notice Address", "", ""],
      ["Date", "", ""],
    ]);
  });

  it("uses the document's own name for the effective date", () => {
    const baa = buildDocument(documentInfo("baa"), { documentId: "baa", fields: {} });
    expect(baa.signingStatement).toContain("as of the BAA Effective Date.");
    expect(baa.partyHeadings).toEqual(["PROVIDER", "COMPANY"]);
  });

  it("includes the Standard Terms, credits Common Paper and says what changed", () => {
    const doc = buildDocument(pilot, pilotDraft);
    expect(doc.terms).toBe(pilot.terms);
    expect(doc.attribution.map((i) => i.text).join("")).toBe(
      "Adapted by Prelegal from the Common Paper Pilot Agreement, free to use under CC BY 4.0. Changes: Prelegal added this Cover Page and reformatted the Standard Terms.",
    );
  });
});

describe("documentFileName", () => {
  it("names the file after the document and the companies", () => {
    expect(documentFileName(pilot, pilotDraft)).toBe("Pilot-Agreement-Acme-Inc-Globex-LLC");
    expect(documentFileName(pilot, { documentId: "pilot", fields: {} })).toBe("Pilot-Agreement");
  });
});

describe("toNdaValues", () => {
  it("turns an NDA draft into the NDA's own values", () => {
    expect(toNdaValues(ndaDraft.fields)).toEqual(filledValues);
  });

  it("maps the open-ended terms", () => {
    const values = toNdaValues({ mndaTerm: "until terminated", confidentialityTerm: "perpetual" });
    expect(values.mndaTerm).toEqual({ kind: "untilTerminated" });
    expect(values.confidentialityTerm).toEqual({ kind: "perpetual" });
  });

  it("starts both terms at 1 year when they are blank", () => {
    const values = toNdaValues({});
    expect(values.mndaTerm).toEqual({ kind: "expires", years: 1 });
    expect(values.confidentialityTerm).toEqual({ kind: "years", years: 1 });
  });
});
