import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCoverIntro, parseStandardTerms } from "./parseTemplate";
import type { NdaTemplate } from "./types";

// The templates live at the repository root, one level above the frontend app.
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

function read(fileName: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, fileName), "utf-8");
}

/** Reads and parses the Mutual NDA templates. Runs on the server at build time. */
export function loadNdaTemplate(): NdaTemplate {
  return {
    coverIntro: parseCoverIntro(read("Mutual-NDA-coverpage.md")),
    ...parseStandardTerms(read("Mutual-NDA.md")),
  };
}
