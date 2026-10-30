import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTerms } from "./parseTerms";
import { NDA_ID, type DocumentField, type DocumentInfo } from "./types";

// documents.json and the templates live at the repository root, one level above the frontend app.
const ROOT = path.join(process.cwd(), "..");

interface RegistryEntry {
  id: string;
  name: string;
  fileName: string;
  template: string;
  parties: [string, string];
  fields: (DocumentField & { hint?: string; default?: string })[];
}

/** Reads every document Prelegal can draft and parses its Standard Terms. Runs at build time. */
export function loadDocuments(): DocumentInfo[] {
  const registry: { documents: RegistryEntry[] } = JSON.parse(readFileSync(path.join(ROOT, "documents.json"), "utf-8"));
  return registry.documents.map(({ id, name, fileName, template, parties, fields }) => ({
    id,
    name,
    fileName,
    parties,
    // Hints and defaults are for the AI; the page only needs what it shows.
    fields: fields.map(({ key, label, kind, essential, openEnded }) => ({ key, label, kind, essential, openEnded })),
    terms: id === NDA_ID ? null : parseTerms(readFileSync(path.join(ROOT, template), "utf-8")).clauses,
  }));
}
