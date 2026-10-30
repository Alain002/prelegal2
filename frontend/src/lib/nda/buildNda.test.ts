import { describe, expect, it } from "vitest";
import { blankNdaValues, filledValues, tinyTemplate } from "@/test/fixtures";
import { buildNda, formatDate, NDA_CHANGES, ndaFileName } from "./buildNda";

import type { NdaValues } from "./types";

const field = (values: NdaValues, heading: string) =>
  buildNda(values, tinyTemplate).coverFields.find((f) => f.heading === heading)?.lines;

const row = (values: NdaValues, label: string) =>
  buildNda(values, tinyTemplate).signatureRows.find((r) => r.label === label)?.values;

describe("formatDate", () => {
  it.each([
    ["2026-01-01", "January 1, 2026"],
    ["2026-12-31", "December 31, 2026"],
    ["2024-02-29", "February 29, 2024"],
    ["2026-07-09", "July 9, 2026"],
  ])("formats %s as %s without timezone drift", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  it.each(["", "not a date", "2026-1-1", "26-01-01", "2026/01/01", "2026-13-01", "2026-00-10", "2026-02-30", "2025-02-29", "2026-04-31", "2026-01-00"])("returns an empty string for %j", (input) => {
    expect(formatDate(input)).toBe("");
  });
});

describe("buildNda", () => {
  it("fills the cover page from the form values", () => {
    expect(field(filledValues, "Purpose")).toEqual(["Exploring a partnership."]);
    expect(field(filledValues, "Effective Date")).toEqual(["November 1, 2026"]);
    expect(field(filledValues, "MNDA Term")).toEqual(["Expires 2 years from Effective Date."]);
    expect(field(filledValues, "Term of Confidentiality")).toEqual([
      "3 years from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
    ]);
    expect(field(filledValues, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
    ]);
    expect(field(filledValues, "MNDA Modifications")).toEqual(["None."]);
  });

  it("lists the cover page fields in template order with their hints", () => {
    const nda = buildNda(filledValues, tinyTemplate);
    expect(nda.coverFields.map((f) => f.heading)).toEqual([
      "Purpose",
      "Effective Date",
      "MNDA Term",
      "Term of Confidentiality",
      "Governing Law & Jurisdiction",
      "MNDA Modifications",
    ]);
    expect(nda.coverFields.find((f) => f.heading === "Purpose")?.hint).toBe("How Confidential Information may be used");
    expect(nda.title).toBe("Mutual Non-Disclosure Agreement");
    expect(nda.signingStatement).toMatch(/^By signing this Cover Page/);
  });

  it("uses the singular for one year", () => {
    expect(field(blankNdaValues, "MNDA Term")).toEqual(["Expires 1 year from Effective Date."]);
    expect(field(blankNdaValues, "Term of Confidentiality")?.[0]).toMatch(/^1 year from Effective Date/);
  });

  it("supports open-ended and perpetual terms", () => {
    const values: NdaValues = {
      ...filledValues,
      mndaTerm: { kind: "untilTerminated" },
      confidentialityTerm: { kind: "perpetual" },
    };
    expect(field(values, "MNDA Term")).toEqual(["Continues until terminated in accordance with the terms of the MNDA."]);
    expect(field(values, "Term of Confidentiality")).toEqual(["In perpetuity."]);
  });

  it("shows placeholders for blank or whitespace-only fields", () => {
    const values: NdaValues = { ...blankNdaValues, purpose: "  ", governingLaw: "\n", jurisdiction: "" };
    expect(field(values, "Purpose")).toEqual(["[Purpose]"]);
    expect(field(values, "Effective Date")).toEqual(["[Effective Date]"]);
    expect(field(values, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: [Governing Law]",
      "Jurisdiction: [Jurisdiction]",
    ]);
  });

  it("trims surrounding whitespace but keeps inner line breaks", () => {
    const values: NdaValues = { ...filledValues, purpose: "  Line one\nLine two  ", modifications: "\n- Change A\n- Change B\n" };
    expect(field(values, "Purpose")).toEqual(["Line one\nLine two"]);
    expect(field(values, "MNDA Modifications")).toEqual(["- Change A\n- Change B"]);
  });

  it("fills both parties and leaves signature and date blank", () => {
    const nda = buildNda(filledValues, tinyTemplate);
    expect(nda.signatureRows.map((r) => r.label)).toEqual([
      "Signature",
      "Print Name",
      "Title",
      "Company",
      "Notice Address",
      "Date",
    ]);
    expect(row(filledValues, "Print Name")).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(row(filledValues, "Title")).toEqual(["CEO", "CTO"]);
    expect(row(filledValues, "Company")).toEqual(["Acme Inc.", "Globex, LLC"]);
    expect(row(filledValues, "Notice Address")).toEqual(["ada@acme.test", "1 Main St\nWilmington, DE"]);
    expect(row(filledValues, "Signature")).toEqual(["", ""]);
    expect(row(filledValues, "Date")).toEqual(["", ""]);
  });

  it("trims party details", () => {
    const values: NdaValues = {
      ...filledValues,
      parties: [
        { name: "  Ada  ", title: " CEO ", company: " Acme ", noticeAddress: " a@b.test " },
        filledValues.parties[1],
      ],
    };
    expect(row(values, "Print Name")?.[0]).toBe("Ada");
    expect(row(values, "Company")?.[0]).toBe("Acme");
  });

  it("includes the template's standard terms unchanged", () => {
    const nda = buildNda(filledValues, tinyTemplate);
    expect(nda.clauses).toBe(tinyTemplate.clauses);
    expect(nda.coverIntro).toBe(tinyTemplate.coverIntro);
    expect(nda.attribution).toEqual([...tinyTemplate.attribution, { kind: "text", text: ` ${NDA_CHANGES}` }]);
  });

  it("does not modify the input values", () => {
    const snapshot = structuredClone(filledValues);
    buildNda(filledValues, tinyTemplate);
    expect(filledValues).toEqual(snapshot);
  });
});

describe("ndaFileName", () => {
  it("includes sanitized company names", () => {
    expect(ndaFileName(filledValues)).toBe("Mutual-NDA-Acme-Inc-Globex-LLC");
  });

  it("strips characters that are unsafe in file names", () => {
    const values: NdaValues = {
      ...filledValues,
      parties: [
        { ...filledValues.parties[0], company: '../evil/<co>:"x"' },
        { ...filledValues.parties[1], company: "Café & Co" },
      ],
    };
    expect(ndaFileName(values)).toBe("Mutual-NDA-evil-co-x-Caf-Co");
  });

  it("skips a missing company", () => {
    const values: NdaValues = { ...filledValues, parties: [{ ...filledValues.parties[0], company: "  " }, filledValues.parties[1]] };
    expect(ndaFileName(values)).toBe("Mutual-NDA-Globex-LLC");
  });

  it("falls back to a generic name", () => {
    expect(ndaFileName(blankNdaValues)).toBe("Mutual-NDA");
  });
});
