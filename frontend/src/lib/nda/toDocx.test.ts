import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { DISCLAIMER, DISCLAIMER_HEADING, DISCLAIMER_SHORT } from "@/lib/disclaimer";
import { filledValues, realTemplate } from "@/test/fixtures";
import { buildNda } from "./buildNda";
import { toDocx } from "./toDocx";
import type { NdaValues } from "./types";

/** Generates the Word file and returns its parts. */
async function generate(values: NdaValues = filledValues) {
  const blob = await toDocx(buildNda(values, realTemplate));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { blob, zip, xml: await zip.file("word/document.xml")!.async("string") };
}

/** The document text with XML tags removed and line breaks kept. */
const textOf = (xml: string) => xml.replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "");

/** Every text run as { text, bold, italic }. */
function runsOf(xml: string) {
  return [...xml.matchAll(/<w:r>(.*?)<\/w:r>/g)].map(([, run]) => ({
    text: textOf(run),
    bold: /<w:b\/>/.test(run),
    italic: /<w:i\/>/.test(run),
  }));
}

/** Cell texts of each row of the first table. */
function tableRows(xml: string) {
  const table = /<w:tbl>(.*?)<\/w:tbl>/.exec(xml)![1];
  return [...table.matchAll(/<w:tr>(.*?)<\/w:tr>/g)].map(([, row]) =>
    [...row.matchAll(/<w:tc>(.*?)<\/w:tc>/g)].map(([, cell]) => textOf(cell)),
  );
}

describe("toDocx", () => {
  it("produces a Word package with the required parts", async () => {
    const { blob, zip } = await generate();
    expect(blob.size).toBeGreaterThan(1000);
    for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]) {
      expect(zip.file(part), part).not.toBeNull();
    }
    const contentTypes = await zip.file("[Content_Types].xml")!.async("string");
    expect(contentTypes).toContain("wordprocessingml.document.main+xml");
  });

  it("contains the filled-in cover page", async () => {
    const text = textOf((await generate()).xml);
    for (const expected of [
      "Mutual Non-Disclosure Agreement",
      "Cover Page",
      "Exploring a partnership.",
      "November 1, 2026",
      "Expires 2 years from Effective Date.",
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("lays out the signature table with a label column and one column per party", async () => {
    expect(tableRows((await generate()).xml)).toEqual([
      ["", "PARTY 1", "PARTY 2"],
      ["Signature", "", ""],
      ["Print Name", "Ada Lovelace", "Alan Turing"],
      ["Title", "CEO", "CTO"],
      ["Company", "Acme Inc.", "Globex, LLC"],
      ["Notice Address", "ada@acme.test", "1 Main St\nWilmington, DE"],
      ["Date", "", ""],
    ]);
  });

  it("contains all 11 Standard Terms clauses with bold titles", async () => {
    const { xml } = await generate();
    const runs = runsOf(xml);
    for (const clause of realTemplate.clauses) {
      const title = `${clause.number}. ${clause.title}. `;
      expect(runs).toContainEqual({ text: title, bold: true, italic: false });
    }
    expect(textOf(xml)).toContain("free to use under CC BY 4.0");
  });

  it("makes defined terms and cover page references bold", async () => {
    const runs = runsOf((await generate()).xml);
    expect(runs).toContainEqual({ text: "Purpose", bold: true, italic: false }); // reference in clause 1
    expect(runs).toContainEqual({ text: "Confidential Information", bold: true, italic: false }); // definition
  });

  it("puts the cover page hints in italics", async () => {
    const runs = runsOf((await generate()).xml);
    expect(runs).toContainEqual({ text: "How Confidential Information may be used", bold: false, italic: true });
  });

  it("keeps hyperlinks", async () => {
    const { zip } = await generate();
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(rels).toContain("https://commonpaper.com/standards/mutual-nda/1.0");
  });

  it("turns multi-line input into Word line breaks, not raw newlines", async () => {
    const { xml } = await generate({ ...filledValues, modifications: "Change A\nChange B" });
    expect(textOf(xml)).toContain("Change A\nChange B");
    expect(xml).not.toMatch(/<w:t[^>]*>[^<]*\n/); // no newline inside any text element
  });

  it("escapes special characters", async () => {
    const values: NdaValues = {
      ...filledValues,
      parties: [{ ...filledValues.parties[0], company: 'Smith & Sons <"Ltd">' }, filledValues.parties[1]],
    };
    const { xml } = await generate(values);
    expect(xml).toContain("Smith &amp; Sons &lt;&quot;Ltd&quot;&gt;");
  });

  it("puts the Standard Terms in a second section so they start on a new page", async () => {
    const { xml } = await generate();
    expect(xml.match(/<w:sectPr/g)).toHaveLength(2);
    const cover = textOf(xml.slice(0, xml.indexOf("<w:sectPr")));
    const terms = textOf(xml.slice(xml.indexOf("</w:sectPr>")));
    expect(cover).toContain("PARTY 1");
    expect(cover).not.toContain("1. Introduction.");
    expect(terms).toMatch(/^Standard Terms1\. Introduction\./);
  });

  it("marks the document as a draft subject to legal review, on every page", async () => {
    const { zip, xml } = await generate();
    const body = textOf(xml);
    expect(body.indexOf(DISCLAIMER_HEADING.toUpperCase())).toBeLessThan(body.indexOf("Cover Page"));
    expect(body).toContain(DISCLAIMER);
    // Both sections (cover page and Standard Terms) use the footer.
    expect(xml.match(/<w:footerReference /g)).toHaveLength(2);
    const footers = Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/.test(name));
    expect(footers.length).toBeGreaterThan(0);
    for (const name of footers) expect(textOf(await zip.file(name)!.async("string"))).toContain(DISCLAIMER_SHORT);
  });
});
