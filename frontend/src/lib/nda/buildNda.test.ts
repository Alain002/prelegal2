import { describe, expect, it } from "vitest";
import { buildNda, formatDate, ndaFileName } from "./buildNda";
import { defaultNdaValues } from "./defaults";
import type { NdaTemplate, NdaValues } from "./types";

const template: NdaTemplate = {
  coverIntro: [{ kind: "text", text: "Intro" }],
  clauses: [{ number: 1, title: "Introduction", body: [{ kind: "text", text: "Body" }] }],
  attribution: [{ kind: "text", text: "Attribution" }],
};

const filled: NdaValues = {
  purpose: "Exploring a partnership.",
  effectiveDate: "2026-11-01",
  mndaTerm: { kind: "expires", years: 2 },
  confidentialityTerm: { kind: "years", years: 3 },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex, LLC", noticeAddress: "1 Main St" },
  ],
};

const field = (values: NdaValues, heading: string) =>
  buildNda(values, template).coverFields.find((f) => f.heading === heading)?.lines;

const row = (values: NdaValues, label: string) =>
  buildNda(values, template).signatureRows.find((r) => r.label === label)?.values;

describe("formatDate", () => {
  it("formats ISO dates without timezone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("2026-12-31")).toBe("December 31, 2026");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
  });
});

describe("buildNda", () => {
  it("fills the cover page from the form values", () => {
    expect(field(filled, "Purpose")).toEqual(["Exploring a partnership."]);
    expect(field(filled, "Effective Date")).toEqual(["November 1, 2026"]);
    expect(field(filled, "MNDA Term")).toEqual(["Expires 2 years from Effective Date."]);
    expect(field(filled, "Term of Confidentiality")?.[0]).toMatch(/^3 years from Effective Date, but in the case of trade secrets/);
    expect(field(filled, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
    ]);
    expect(field(filled, "MNDA Modifications")).toEqual(["None."]);
  });

  it("uses the singular for one year", () => {
    expect(field(defaultNdaValues, "MNDA Term")).toEqual(["Expires 1 year from Effective Date."]);
  });

  it("supports open-ended and perpetual terms", () => {
    const values: NdaValues = {
      ...filled,
      mndaTerm: { kind: "untilTerminated" },
      confidentialityTerm: { kind: "perpetual" },
    };
    expect(field(values, "MNDA Term")).toEqual(["Continues until terminated in accordance with the terms of the MNDA."]);
    expect(field(values, "Term of Confidentiality")).toEqual(["In perpetuity."]);
  });

  it("shows placeholders for blank fields", () => {
    const values: NdaValues = { ...defaultNdaValues, purpose: "  " };
    expect(field(values, "Purpose")).toEqual(["[Purpose]"]);
    expect(field(values, "Effective Date")).toEqual(["[Effective Date]"]);
    expect(field(values, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: [Governing Law]",
      "Jurisdiction: [Jurisdiction]",
    ]);
  });

  it("fills both parties and leaves signature and date blank", () => {
    expect(row(filled, "Print Name")).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(row(filled, "Company")).toEqual(["Acme Inc.", "Globex, LLC"]);
    expect(row(filled, "Notice Address")).toEqual(["ada@acme.test", "1 Main St"]);
    expect(row(filled, "Signature")).toEqual(["", ""]);
    expect(row(filled, "Date")).toEqual(["", ""]);
  });

  it("includes the template's standard terms unchanged", () => {
    const nda = buildNda(filled, template);
    expect(nda.clauses).toBe(template.clauses);
    expect(nda.coverIntro).toBe(template.coverIntro);
  });
});

describe("ndaFileName", () => {
  it("includes sanitized company names", () => {
    expect(ndaFileName(filled)).toBe("Mutual-NDA-Acme-Inc-Globex-LLC");
  });

  it("falls back to a generic name", () => {
    expect(ndaFileName(defaultNdaValues)).toBe("Mutual-NDA");
  });
});
