import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCoverIntro, parseInline, parseStandardTerms } from "./parseTemplate";

const templatesDir = path.resolve(__dirname, "../../../../templates");
const read = (name: string) => readFileSync(path.join(templatesDir, name), "utf-8");

describe("parseInline", () => {
  it("splits bold, cover page terms and links", () => {
    expect(
      parseInline('A **bold** use of <span class="coverpage_link">Purpose</span> per [CC BY](https://x.org).'),
    ).toEqual([
      { kind: "text", text: "A " },
      { kind: "bold", text: "bold" },
      { kind: "text", text: " use of " },
      { kind: "term", text: "Purpose" },
      { kind: "text", text: " per " },
      { kind: "link", text: "CC BY", href: "https://x.org" },
      { kind: "text", text: "." },
    ]);
  });

  it("returns plain text unchanged", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
  });
});

describe("parseStandardTerms", () => {
  it("parses all 11 clauses of the Mutual NDA template", () => {
    const { clauses, attribution } = parseStandardTerms(read("Mutual-NDA.md"));

    expect(clauses.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(clauses[0].title).toBe("Introduction");
    expect(clauses[8].title).toBe("Governing Law and Jurisdiction");
    expect(clauses[8].body).toContainEqual({ kind: "term", text: "Governing Law" });
    expect(attribution).toContainEqual({
      kind: "link",
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("handles Windows line endings", () => {
    const { clauses } = parseStandardTerms("# Standard Terms\r\n\r\n1. **One**. First.\r\n\r\n2. **Two**. Second.");
    expect(clauses.map((c) => c.title)).toEqual(["One", "Two"]);
  });

  it("throws when no clauses are found", () => {
    expect(() => parseStandardTerms("# Nothing here")).toThrow(/No numbered clauses/);
  });
});

describe("parseCoverIntro", () => {
  it("extracts the introductory paragraph of the cover page", () => {
    const intro = parseCoverIntro(read("Mutual-NDA-coverpage.md"));
    expect(intro[0]).toEqual({ kind: "text", text: expect.stringMatching(/^This Mutual Non-Disclosure Agreement/) });
    expect(intro).toContainEqual({ kind: "bold", text: "Standard Terms" });
  });
});
