import { describe, expect, it } from "vitest";
import { readTemplate } from "@/test/fixtures";
import { parseCoverIntro, parseInline, parseStandardTerms } from "./parseTemplate";
import type { Inline } from "./types";

/** Joins inline runs back into plain text. */
const plain = (inlines: Inline[]) => inlines.map((i) => i.text).join("");

/** Strips the Markdown/HTML markup the parser understands. */
const stripMarkup = (source: string) =>
  source
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/<span class="coverpage_link">(.+?)<\/span>/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1");

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

  it("returns nothing for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });

  it("handles adjacent markup without empty text runs", () => {
    expect(parseInline("**a****b**")).toEqual([
      { kind: "bold", text: "a" },
      { kind: "bold", text: "b" },
    ]);
  });

  it("treats unmatched markup as plain text", () => {
    expect(parseInline("a **dangling bold")).toEqual([{ kind: "text", text: "a **dangling bold" }]);
  });

  it("keeps curly quotes and other unicode", () => {
    expect(parseInline("(“**MNDA**”)")).toEqual([
      { kind: "text", text: "(“" },
      { kind: "bold", text: "MNDA" },
      { kind: "text", text: "”)" },
    ]);
  });

  it("reads every kind of defined-term span, with or without an id", () => {
    expect(
      parseInline('<span class="keyterms_link">Fees</span>, <span class="orderform_link" id="5.5.a">Customer</span>'),
    ).toEqual([
      { kind: "term", text: "Fees" },
      { kind: "text", text: ", " },
      { kind: "term", text: "Customer" },
    ]);
  });

  it("keeps defined terms inside bold passages", () => {
    expect(parseInline('**Each <span class="keyterms_link">Provider</span> may.**')).toEqual([
      { kind: "bold", text: "Each " },
      { kind: "term", text: "Provider" },
      { kind: "bold", text: " may." },
    ]);
  });

  it("turns bare links into links, and adds https:// where a link lacks it", () => {
    expect(parseInline("at <https://commonpaper.com/x>.")).toEqual([
      { kind: "text", text: "at " },
      { kind: "link", text: "https://commonpaper.com/x", href: "https://commonpaper.com/x" },
      { kind: "text", text: "." },
    ]);
    expect(parseInline("[site](commonpaper.com/y)")).toEqual([{ kind: "link", text: "site", href: "https://commonpaper.com/y" }]);
  });
});

describe("parseStandardTerms", () => {
  const source = readTemplate("Mutual-NDA.md");
  const { clauses, attribution } = parseStandardTerms(source);

  it("parses all 11 clauses of the Mutual NDA template in order", () => {
    expect(clauses.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(clauses.map((c) => c.title)).toEqual([
      "Introduction",
      "Use and Protection of Confidential Information",
      "Exceptions",
      "Disclosures Required by Law",
      "Term and Termination",
      "Return or Destruction of Confidential Information",
      "Proprietary Rights",
      "Disclaimer",
      "Governing Law and Jurisdiction",
      "Equitable Relief",
      "General",
    ]);
  });

  it("keeps the exact wording of every clause", () => {
    // Rebuild each clause as plain text and compare with the template minus its markup.
    for (const clause of clauses) {
      const rebuilt = `${clause.number}. ${clause.title}. ${plain(clause.body)}`;
      expect(stripMarkup(source)).toContain(rebuilt);
    }
  });

  it("drops no text: the template is exactly the heading, the clauses and the attribution", () => {
    // Uses plain string operations rather than the parser's patterns, so a shared bug can't cancel out.
    const rebuilt = [
      "# Standard Terms",
      ...clauses.map((c) => `${c.number}. ${c.title}. ${plain(c.body)}`),
      plain(attribution),
    ].join("");
    const original = source
      .split("**").join("")
      .split('<span class="coverpage_link">').join("")
      .split("</span>").join("")
      .split("[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)").join("CC BY 4.0")
      .split("[Version 1.0](https://commonpaper.com/standards/mutual-nda/1.0/)").join("Version 1.0")
      .replace(/\s*\n\s*/g, "");
    expect(rebuilt.replace(/\s*\n\s*/g, "")).toBe(original);
  });

  it("marks every cover page reference as a term", () => {
    const termRuns = clauses.flatMap((c) => c.body.filter((i) => i.kind === "term").map((i) => i.text));
    // One term run per <span class="coverpage_link"> in the template.
    expect(termRuns).toHaveLength(source.split('<span class="coverpage_link">').length - 1);
    expect([...new Set(termRuns)].sort()).toEqual(
      ["Effective Date", "Governing Law", "Jurisdiction", "MNDA Term", "Purpose", "Term of Confidentiality"].sort(),
    );
    expect(clauses.some((c) => c.body.some((i) => i.text.includes("<span")))).toBe(false);
  });

  it("keeps the attribution and license link", () => {
    expect(attribution).toContainEqual({
      kind: "link",
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    });
    expect(plain(attribution)).toMatch(/^Common Paper Mutual Non-Disclosure Agreement/);
  });

  it("handles Windows line endings", () => {
    const parsed = parseStandardTerms("# Standard Terms\r\n\r\n1. **One**. First.\r\n\r\n2. **Two**. Second.");
    expect(parsed.clauses.map((c) => c.title)).toEqual(["One", "Two"]);
  });

  it("keeps clause text that spans several lines", () => {
    const parsed = parseStandardTerms("1. **One**. First line\ncontinues here.");
    expect(plain(parsed.clauses[0].body)).toBe("First line\ncontinues here.");
  });

  it("returns an empty attribution when there is none", () => {
    expect(parseStandardTerms("1. **One**. Only a clause.").attribution).toEqual([]);
  });

  it("throws when no clauses are found", () => {
    expect(() => parseStandardTerms("# Nothing here")).toThrow(/No numbered clauses/);
  });
});

describe("parseCoverIntro", () => {
  it("extracts the introductory paragraph of the cover page", () => {
    const intro = parseCoverIntro(readTemplate("Mutual-NDA-coverpage.md"));
    expect(intro[0]).toEqual({ kind: "text", text: expect.stringMatching(/^This Mutual Non-Disclosure Agreement/) });
    expect(intro).toContainEqual({ kind: "bold", text: "Cover Page" });
    expect(intro).toContainEqual({ kind: "bold", text: "Standard Terms" });
    expect(intro).toContainEqual({
      kind: "link",
      text: "commonpaper.com/standards/mutual-nda/1.0",
      href: "https://commonpaper.com/standards/mutual-nda/1.0",
    });
    expect(plain(intro)).toMatch(/will control over conflicts with the Standard Terms\.$/);
  });

  it("throws when the paragraph is missing", () => {
    expect(() => parseCoverIntro("# Cover\n\nSomething else")).toThrow(/Introductory paragraph not found/);
  });
});
