import type { NdaValues, Party } from "./types";

const emptyParty = (): Party => ({ name: "", title: "", company: "", noticeAddress: "" });

/** Starting form values, matching the defaults suggested by the Cover Page template. */
export const defaultNdaValues: NdaValues = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTerm: { kind: "expires", years: 1 },
  confidentialityTerm: { kind: "years", years: 1 },
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  parties: [emptyParty(), emptyParty()],
};

/** Today's date as yyyy-mm-dd in the user's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
