import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { documentInfo, documents, pilotDraft } from "@/test/fixtures";
import { buildDocument } from "./buildDocument";
import { documentToDocx } from "./toDocx";
import type { Draft } from "./types";

async function generate(id = "pilot", draft: Draft = pilotDraft) {
  const blob = await documentToDocx(buildDocument(documentInfo(id), draft));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { blob, zip, xml: await zip.file("word/document.xml")!.async("string") };
}

const textOf = (xml: string) => xml.replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "");

describe("documentToDocx", () => {
  it("contains the filled-in cover page and the signature table", async () => {
    const text = textOf((await generate()).xml);
    for (const expected of ["Pilot Agreement", "Cover Page", "Provider: Acme Inc.", "Pilot Period", "90 days", "November 1, 2026", "PROVIDER", "CUSTOMER", "Ada Lovelace"]) {
      expect(text).toContain(expected);
    }
  });

  it("contains the numbered Standard Terms in a second section", async () => {
    const { xml } = await generate();
    expect(xml.match(/<w:sectPr/g)).toHaveLength(2);
    const terms = textOf(xml.slice(xml.indexOf("</w:sectPr>")));
    expect(terms).toMatch(/^Standard Terms1\. /);
    expect(terms).toContain("1.1 ");
    expect(terms).toContain("(a) ");
    expect(terms).toContain("Adapted by Prelegal from the Common Paper Pilot Agreement");
  });

  it("indents sub-clauses", async () => {
    const { xml } = await generate();
    expect(xml).toContain('w:left="360"');
    expect(xml).toContain('w:left="720"');
  });

  it("keeps hyperlinks", async () => {
    const rels = await (await generate()).zip.file("word/_rels/document.xml.rels")!.async("string");
    expect(rels).toContain("https://creativecommons.org/licenses/by/4.0/");
    expect(rels).toContain("https://commonpaper.com/standards/pilot-agreement/1.1");
  });

  it.each(documents.filter((d) => d.terms).map((d) => d.id))("builds a Word file for %s", async (id) => {
    const { blob } = await generate(id, { documentId: id, fields: {} });
    expect(blob.size).toBeGreaterThan(5000);
  });
});
