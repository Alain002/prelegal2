import { describe, expect, it } from "vitest";
import type { Inline } from "@/lib/nda/types";
import { documents, readTemplate } from "@/test/fixtures";
import { parseTerms } from "./parseTerms";
import type { TermNode } from "./types";

const text = (inlines: Inline[]) => inlines.map((i) => i.text).join("");
const allNodes = (nodes: TermNode[]): TermNode[] => nodes.flatMap((n) => [n, ...allNodes(n.children)]);
const terms = (file: string) => parseTerms(readTemplate(file));
/** The templates other than the NDA, which has its own parser. */
const others = documents.filter((d) => d.terms).map((d) => [d.name, d.terms!] as const);

describe("parseTerms", () => {
  it("numbers clauses by position: 1., 1.1, (a), (i)", () => {
    const { title, clauses } = parseTerms(
      [
        "# Example Terms",
        "",
        '1. <span class="header_2" id="1">Service</span>',
        '    1. <span class="header_3" id="1.1">Access.</span>  You may use it.',
        "    1. Second.",
        "        a. First letter.",
        "            i. Roman one.",
        "            i. Roman two.",
        "        a. Second letter.",
        "",
        '1. <span class="header_2">Fees</span>',
        "    1. Pay on time.",
      ].join("\n"),
    );
    expect(title).toBe("Example Terms");
    expect(allNodes(clauses).map((n) => n.label)).toEqual(["1.", "1.1", "1.2", "(a)", "(i)", "(ii)", "(b)", "2.", "2.1"]);
    const [service] = clauses;
    expect(text(service.heading)).toBe("Service");
    expect(text(service.children[0].heading)).toBe("Access.");
    expect(text(service.children[0].body)).toBe("You may use it.");
    expect(service.children[1].heading).toEqual([]);
    expect(text(service.children[1].body)).toBe("Second.");
  });

  it("keeps defined terms, drops cross-reference anchors and moves a stray full stop into the title", () => {
    const [clause] = parseTerms(
      [
        '1. <span class="header_2" id="1">One</span>',
        '    1. <span class="header_3" id="1.1">Payment Dispute</span>.  <span id="1.1.a">If</span> the <span class="orderform_link" id="x">Customer</span> objects.',
      ].join("\n"),
    ).clauses;
    const [child] = clause.children;
    expect(text(child.heading)).toBe("Payment Dispute.");
    expect(child.body).toEqual([
      { kind: "text", text: "If the " },
      { kind: "term", text: "Customer" },
      { kind: "text", text: " objects." },
    ]);
  });

  it("treats a top-level clause without a title span as a section title", () => {
    const [clause] = parseTerms("1. Definitions\n    1. **\"Affiliate\"** means ...").clauses;
    expect(text(clause.heading)).toBe("Definitions");
    expect(clause.children[0].body[0]).toEqual({ kind: "bold", text: '"Affiliate"' });
  });

  it.each([
    ["text outside the list", "1. One\nStray paragraph"],
    ["an odd indent", "1. One\n  1. Two"],
    ["a skipped level", "1. One\n        a. Too deep"],
  ])("rejects %s", (_, source) => {
    expect(() => parseTerms(source)).toThrow("Unexpected line");
  });

  it("rejects a template without clauses", () => {
    expect(() => parseTerms("# Only a title")).toThrow("No clauses");
  });

  it("handles Windows line endings", () => {
    expect(parseTerms("1. One\r\n    1. Two\r\n").clauses[0].children).toHaveLength(1);
  });
});

describe.each(others)("the %s template", (_, clauses) => {
  it("parses into numbered sections with no markup left over", () => {
    const nodes = allNodes(clauses);
    expect(clauses.length).toBeGreaterThan(3);
    for (const node of nodes) {
      const all = [...node.heading, ...node.body].map((i) => i.text).join("");
      expect(all, node.label).not.toMatch(/<\/?span|class=|\*\*|\]\(/);
    }
    // Every top-level clause is a titled section.
    expect(clauses.every((n) => n.heading.length > 0)).toBe(true);
  });
});

describe("real templates", () => {
  it("numbers the Cloud Service Agreement like the original", () => {
    const { title, clauses } = terms("CSA.md");
    expect(title).toBe("Cloud Service Agreement");
    expect(clauses).toHaveLength(13);
    expect(text(clauses[0].heading)).toBe("Service");
    expect(clauses[1].children[0].label).toBe("2.1");
    expect(text(clauses[1].children[0].heading)).toBe("Restrictions on Customer.");
    expect(clauses[1].children[0].children.map((n) => n.label)).toEqual(["(a)", "(b)"]);
  });

  it("parses the roman sub-clauses of the DPA", () => {
    const romans = allNodes(terms("DPA.md").clauses).filter((n) => n.label.startsWith("(i") || n.label.startsWith("(v"));
    expect(romans.map((n) => n.label)).toEqual(["(i)", "(ii)", "(iii)", "(iv)", "(v)", "(vi)", "(vii)"]);
  });

  it("keeps the bold liability clauses, with the defined terms inside them", () => {
    const nodes = allNodes(terms("CSA.md").clauses);
    const cap = nodes.find((n) => text(n.body).startsWith("Except as provided in the Cover Page"))!;
    expect(cap.body.some((i) => i.kind === "bold")).toBe(true);
    expect(cap.body.some((i) => i.kind === "term")).toBe(true);
  });

  it("turns bare links into links", () => {
    const links = allNodes(terms("Pilot-Agreement.md").clauses).flatMap((n) => n.body.filter((i) => i.kind === "link"));
    expect(links).toContainEqual({ kind: "link", text: "https://commonpaper.com/standards/pilot-agreement/1.1", href: "https://commonpaper.com/standards/pilot-agreement/1.1" });
  });

  it("fixes the Partnership Agreement's link that lacks https://", () => {
    const links = allNodes(terms("Partnership-Agreement.md").clauses).flatMap((n) => n.body.filter((i) => i.kind === "link"));
    expect(links.map((l) => l.kind === "link" && l.href)).toEqual(["https://commonpaper.com/standards/partnership-agreement/1.0"]);
  });
});
