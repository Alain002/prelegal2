import { test as base, expect, type Page } from "@playwright/test";

/**
 * Playwright's `test`, extended so every test fails if the page logs a console
 * error or throws an uncaught exception.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const preview = (page: Page) => page.getByRole("region", { name: "Agreement preview" });
export const partyGroup = (page: Page, n: 1 | 2) => page.getByRole("group", { name: `Party ${n}` });

/** Opens the app and waits until the Effective Date default has been applied. */
export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("Effective Date", { exact: true })).not.toHaveValue("");
}

/** The agreement typed in by `fillForm`, and what the preview should then show. */
export const AGREEMENT = {
  purpose: "Evaluating a joint product launch.",
  effectiveDate: "2026-11-15",
  effectiveDateText: "November 15, 2026",
  mndaYears: "2",
  confidentialityYears: "5",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 8 does not apply.\nNotices by email only.",
  parties: [
    { n: 1, company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", address: "ada@acme.test" },
    { n: 2, company: "Globex, LLC", name: "Alan Turing", title: "CTO", address: "1 Main St\nWilmington, DE 19801" },
  ],
  fileName: "Mutual-NDA-Acme-Inc-Globex-LLC.docx",
} as const;

/** Fills in every field of the form with `AGREEMENT`. */
export async function fillForm(page: Page) {
  await page.getByLabel(/^Purpose/).fill(AGREEMENT.purpose);
  await page.getByLabel("Effective Date", { exact: true }).fill(AGREEMENT.effectiveDate);
  await page.getByLabel("MNDA term in years").fill(AGREEMENT.mndaYears);
  await page.getByLabel("Confidentiality term in years").fill(AGREEMENT.confidentialityYears);
  await page.getByLabel(/^Governing Law/).fill(AGREEMENT.governingLaw);
  await page.getByLabel(/^Jurisdiction/).fill(AGREEMENT.jurisdiction);
  await page.getByLabel(/^MNDA Modifications/).fill(AGREEMENT.modifications);

  for (const p of AGREEMENT.parties) {
    const group = partyGroup(page, p.n);
    await group.getByLabel("Company").fill(p.company);
    await group.getByLabel("Signer name").fill(p.name);
    await group.getByLabel("Signer title").fill(p.title);
    await group.getByLabel(/^Notice address/).fill(p.address);
  }
}
