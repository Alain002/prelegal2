import { readFileSync } from "node:fs";
import path from "node:path";
import { loadDocuments } from "@/lib/documents/loadDocuments";
import { toNdaValues } from "@/lib/documents/buildDocument";
import { parseCoverIntro, parseStandardTerms } from "@/lib/nda/parseTemplate";
import type { NdaTemplate, NdaValues } from "@/lib/nda/types";

const templatesDir = path.resolve(import.meta.dirname, "../../../templates");

/** Reads a file from the repository's templates directory. */
export const readTemplate = (name: string) => readFileSync(path.join(templatesDir, name), "utf-8");

/** The real Mutual NDA templates, parsed the same way the app does at build time. */
export const realTemplate: NdaTemplate = {
  coverIntro: parseCoverIntro(readTemplate("Mutual-NDA-coverpage.md")),
  ...parseStandardTerms(readTemplate("Mutual-NDA.md")),
};

/** A small template for tests that don't care about the legal text. */
export const tinyTemplate: NdaTemplate = {
  coverIntro: [{ kind: "text", text: "Intro" }],
  clauses: [{ number: 1, title: "Introduction", body: [{ kind: "term", text: "Purpose" }] }],
  attribution: [{ kind: "link", text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }],
};

/** A fully completed agreement. */
export const filledValues: NdaValues = {
  purpose: "Exploring a partnership.",
  effectiveDate: "2026-11-01",
  mndaTerm: { kind: "expires", years: 2 },
  confidentialityTerm: { kind: "years", years: 3 },
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex, LLC", noticeAddress: "1 Main St\nWilmington, DE" },
  ],
};

export { ndaDraft, pilotDraft } from "./drafts";

/** NDA values with nothing filled in yet. */
export const blankNdaValues = toNdaValues({});

/** documents.json as written, including what the page doesn't load (defaults and hints for the AI). */
export const registry: { documents: { id: string; fields: { key: string; default?: string }[] }[] } = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../../../documents.json"), "utf-8"),
);

/** Every document, loaded the same way the page does at build time. */
export const documents = loadDocuments();
export const documentInfo = (id: string) => documents.find((d) => d.id === id)!;
