import { describe, expect, it } from "vitest";
import { filledValues, readTemplate, registry, tinyTemplate } from "@/test/fixtures";
import { buildNda } from "./buildNda";
import type { NdaValues } from "./types";

/**
 * The cover page is generated in code rather than parsed, so its wording is
 * checked here against the template file. If the template changes, these fail.
 */
const coverPage = readTemplate("Mutual-NDA-coverpage.md").replace(/\s+/g, " ");

const allTermOptions: NdaValues[] = [
  filledValues,
  { ...filledValues, mndaTerm: { kind: "untilTerminated" }, confidentialityTerm: { kind: "perpetual" } },
];

describe("cover page wording matches the template", () => {
  it("uses the template's suggested purpose as the default (set in documents.json)", () => {
    const nda = registry.documents.find((d) => d.id === "mutual-nda")!;
    const purpose = nda.fields.find((f) => f.key === "purpose")!.default;
    expect(purpose).toBeTruthy();
    expect(coverPage).toContain(`[${purpose}]`);
  });

  it("uses the template's sentence for each term option", () => {
    for (const values of allTermOptions) {
      const nda = buildNda(values, tinyTemplate);
      for (const heading of ["MNDA Term", "Term of Confidentiality"]) {
        const line = nda.coverFields.find((f) => f.heading === heading)!.lines[0];
        // The template writes the number of years as a "[1 year(s)]" blank.
        const templated = line.replace(/^(Expires )?\d+ years? /, (_, expires = "") => `${expires}[1 year(s)] `);
        expect(coverPage, line).toContain(templated);
      }
    }
  });

  it("uses the template's headings and hints", () => {
    const nda = buildNda(filledValues, tinyTemplate);
    for (const field of nda.coverFields) {
      expect(coverPage).toContain(`### ${field.heading}`);
      if (field.hint) expect(coverPage).toContain(`<label>${field.hint}</label>`);
    }
    for (const row of nda.signatureRows) {
      expect(coverPage).toContain(`| ${row.label}`);
      if (row.hint) expect(coverPage).toContain(`<label>${row.hint}</label>`);
    }
  });

  it("uses the template's signing statement", () => {
    expect(coverPage).toContain(buildNda(filledValues, tinyTemplate).signingStatement);
  });

  it("uses the template's labels for governing law and jurisdiction", () => {
    expect(coverPage).toContain("Governing Law: [");
    expect(coverPage).toContain("Jurisdiction: [");
  });
});
