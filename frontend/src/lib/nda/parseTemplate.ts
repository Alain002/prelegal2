import type { Clause, Inline, NdaTemplate } from "./types";

// Matches, in order: **bold**, <span class="coverpage_link">Term</span>, [text](url)
const INLINE_PATTERN =
  /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>|\[(.+?)\]\((.+?)\)/g;

const CLAUSE_PATTERN = /^(\d+)\.\s+\*\*(.+?)\*\*\.\s*([\s\S]*)$/;

/** Splits a line of template Markdown into inline runs. */
export function parseInline(source: string): Inline[] {
  const result: Inline[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) {
      result.push({ kind: "text", text: source.slice(cursor, match.index) });
    }
    const [, bold, term, linkText, href] = match;
    if (bold !== undefined) result.push({ kind: "bold", text: bold });
    else if (term !== undefined) result.push({ kind: "term", text: term });
    else result.push({ kind: "link", text: linkText, href });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    result.push({ kind: "text", text: source.slice(cursor) });
  }
  return result;
}

/** Splits Markdown into paragraphs, dropping headings. */
function paragraphs(markdown: string): string[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith("#"));
}

/** Parses the Standard Terms template into numbered clauses. */
export function parseStandardTerms(markdown: string): Pick<NdaTemplate, "clauses" | "attribution"> {
  const clauses: Clause[] = [];
  const other: string[] = [];

  for (const block of paragraphs(markdown)) {
    const match = CLAUSE_PATTERN.exec(block);
    if (match) {
      clauses.push({ number: Number(match[1]), title: match[2], body: parseInline(match[3]) });
    } else {
      other.push(block);
    }
  }

  if (clauses.length === 0) {
    throw new Error("No numbered clauses found in the Standard Terms template");
  }
  return { clauses, attribution: parseInline(other.at(-1) ?? "") };
}

/** Extracts the introductory paragraph from the Cover Page template. */
export function parseCoverIntro(markdown: string): Inline[] {
  const intro = paragraphs(markdown).find((block) =>
    block.startsWith("This Mutual Non-Disclosure Agreement"),
  );
  if (!intro) {
    throw new Error("Introductory paragraph not found in the Cover Page template");
  }
  return parseInline(intro);
}
