import type { Draft } from "../lib/documents/types";

// Drafts as the AI fills them in, shared by the unit tests and the end-to-end tests. Only types
// are imported here, so Playwright can load this file too.

/** A Mutual NDA draft with every field filled in: the draft form of `filledValues`. */
export const ndaDraft = {
  documentId: "mutual-nda",
  fields: {
    purpose: "Exploring a partnership.",
    effectiveDate: "2026-11-01",
    mndaTerm: "2",
    confidentialityTerm: "3",
    governingLaw: "Delaware",
    chosenCourts: "courts located in New Castle, DE",
    party1Company: "Acme Inc.",
    party1Name: "Ada Lovelace",
    party1Title: "CEO",
    party1NoticeAddress: "ada@acme.test",
    party2Company: "Globex, LLC",
    party2Name: "Alan Turing",
    party2Title: "CTO",
    party2NoticeAddress: "1 Main St\nWilmington, DE",
  },
} satisfies Draft;

/** A Pilot Agreement draft with every essential field filled in. */
export const pilotDraft = {
  documentId: "pilot",
  fields: {
    party1Company: "Acme Inc.",
    party2Company: "Globex LLC",
    effectiveDate: "2026-11-01",
    product: "Acme Analytics",
    pilotPeriod: "90 days",
    generalCapAmount: "$50,000",
    governingLaw: "Delaware",
    chosenCourts: "courts located in Wilmington, Delaware",
    party1Name: "Ada Lovelace",
    party2Name: "Alan Turing",
  },
} satisfies Draft;
