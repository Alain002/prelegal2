import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildNda } from "./buildNda";
import { defaultNdaValues } from "./defaults";
import { toDocx } from "./toDocx";

describe("toDocx", () => {
  it("produces a Word document containing the filled-in agreement", async () => {
    const nda = buildNda(
      {
        ...defaultNdaValues,
        governingLaw: "Delaware",
        parties: [
          { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
          { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "1 Main St\nWilmington, DE" },
        ],
      },
      {
        coverIntro: [{ kind: "text", text: "Intro" }],
        clauses: [{ number: 1, title: "Introduction", body: [{ kind: "term", text: "Purpose" }] }],
        attribution: [{ kind: "link", text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }],
      },
    );

    const blob = await toDocx(nda);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");

    for (const text of ["Mutual Non-Disclosure Agreement", "Governing Law: Delaware", "Acme Inc.", "Alan Turing", "Introduction"]) {
      expect(xml).toContain(text);
    }
    // Multi-line input becomes a Word line break rather than a raw newline.
    expect(xml).toMatch(/1 Main St<\/w:t><\/w:r><w:r>(<w:rPr>.*?<\/w:rPr>)?<w:br\/><w:t[^>]*>Wilmington, DE/);
    expect(xml).not.toContain("1 Main St\n");
  });
});
