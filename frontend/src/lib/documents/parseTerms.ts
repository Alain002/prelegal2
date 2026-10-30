import { parseInline } from "@/lib/nda/parseTemplate";
import type { TermNode } from "./types";

// Every line of a Standard Terms template is the "# Title" or a list item. Items are all written
// "1." (or "a.", "i."), nested in steps of 4 spaces, so the printed numbers come from their position.
const ITEM = /^( *)(?:\d+|[a-z]+)\.\s+(.*)$/;
const INDENT = 4;
// A clause title, e.g. <span class="header_3" id="1.1">Access and Use.</span>. One template puts
// the full stop after the span.
const HEADING = /^<span class="header_\d"(?: id="[^"]*")?>(.+?)<\/span>(\.?)\s*(.*)$/;
// Anchors for cross-references, e.g. <span id="5.3.a">if</span>; only their text is kept.
const ANCHOR = /<span id="[^"]*">(.*?)<\/span>/g;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const ROMANS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"];

function label(depth: number, n: number, section: number): string {
  switch (depth) {
    case 0:
      return `${n}.`;
    case 1:
      return `${section}.${n}`;
    case 2:
      return `(${LETTERS[n - 1]})`;
    default:
      return `(${ROMANS[n - 1]})`;
  }
}

function clause(depth: number, text: string): Pick<TermNode, "heading" | "body"> {
  const source = text.replace(ANCHOR, "$1");
  const heading = HEADING.exec(source);
  if (heading) return { heading: parseInline(heading[1] + heading[2]), body: parseInline(heading[3]) };
  // A top-level clause without a title span, e.g. "11. Definitions", is still a section title.
  if (depth === 0) return { heading: parseInline(source), body: [] };
  return { heading: [], body: parseInline(source) };
}

/** Parses a Standard Terms template into its title and nested, numbered clauses. */
export function parseTerms(markdown: string): { title: string; clauses: TermNode[] } {
  let title = "";
  const clauses: TermNode[] = [];
  // The latest clause at each depth, so the next deeper item knows its parent.
  const open: TermNode[] = [];

  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    const item = ITEM.exec(line);
    const depth = item ? item[1].length / INDENT : NaN;
    if (!item || !Number.isInteger(depth) || depth > open.length) {
      throw new Error(`Unexpected line in a Standard Terms template: ${line.slice(0, 80)}`);
    }
    const siblings = depth === 0 ? clauses : open[depth - 1].children;
    const node: TermNode = {
      label: label(depth, siblings.length + 1, clauses.length),
      ...clause(depth, item[2]),
      children: [],
    };
    siblings.push(node);
    open.length = depth;
    open.push(node);
  }

  if (clauses.length === 0) throw new Error("No clauses found in the Standard Terms template");
  return { title, clauses };
}
