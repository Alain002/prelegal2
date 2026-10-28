import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import { AGREEMENT, expect, fillForm, openApp, partyGroup, preview, test } from "./helpers";

test.describe("Mutual NDA Creator", () => {
  test("loads with sensible defaults @mobile", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();
    await expect(page.getByLabel(/^Purpose/)).toHaveValue(
      "Evaluating whether to enter into a business relationship with the other party.",
    );

    // Today's date, in the browser's timezone.
    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    await expect(page.getByLabel("Effective Date", { exact: true })).toHaveValue(today);

    const doc = preview(page);
    await expect(doc.getByText("Expires 1 year from Effective Date.")).toBeVisible();
    await expect(doc.getByText("Governing Law: [Governing Law]")).toBeVisible();
    await expect(doc.getByRole("listitem")).toHaveCount(11);
  });

  test("fills the whole agreement from the form", async ({ page }) => {
    await openApp(page);
    await fillForm(page);
    const doc = preview(page);

    await expect(doc.getByText(AGREEMENT.purpose)).toBeVisible();
    await expect(doc.getByText(AGREEMENT.effectiveDateText)).toBeVisible();
    await expect(doc.getByText(`Expires ${AGREEMENT.mndaYears} years from Effective Date.`)).toBeVisible();
    await expect(doc.getByText(new RegExp(`^${AGREEMENT.confidentialityYears} years from Effective Date, but`))).toBeVisible();
    await expect(doc.getByText(`Governing Law: ${AGREEMENT.governingLaw}`)).toBeVisible();
    await expect(doc.getByText(`Jurisdiction: ${AGREEMENT.jurisdiction}`)).toBeVisible();
    await expect(doc.getByText(/^Section 8 does not apply\./)).toHaveText(AGREEMENT.modifications);

    const table = doc.getByRole("table");
    for (const p of AGREEMENT.parties) {
      for (const value of [p.company, p.name, p.title, p.address]) {
        await expect(table.getByRole("cell", { name: value.split("\n")[0] })).toHaveText(value);
      }
    }
  });

  test("switches between fixed and open-ended terms", async ({ page }) => {
    await openApp(page);
    const doc = preview(page);

    await page.getByLabel("Continues until terminated").check();
    await expect(page.getByLabel("MNDA term in years")).toBeDisabled();
    await expect(doc.getByText("Continues until terminated in accordance with the terms of the MNDA.")).toBeVisible();

    await page.getByLabel("In perpetuity").check();
    await expect(doc.getByText("In perpetuity.")).toBeVisible();

    await page.getByLabel(/^Expires/).check();
    await expect(page.getByLabel("MNDA term in years")).toBeEnabled();
    await expect(doc.getByText("Expires 1 year from Effective Date.")).toBeVisible();
  });

  test("lets the user clear and retype the years", async ({ page }) => {
    await openApp(page);
    const years = page.getByLabel("MNDA term in years");

    await years.clear();
    await expect(years).toHaveValue("");
    await years.pressSequentially("5");
    await expect(years).toHaveValue("5");
    await expect(preview(page).getByText("Expires 5 years from Effective Date.")).toBeVisible();

    // Out-of-range values are not accepted.
    await years.fill("0");
    await years.blur();
    await expect(years).toHaveValue("5");
  });

  test("downloads a complete Word document", async ({ page }) => {
    await openApp(page);
    await fillForm(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Word" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(AGREEMENT.fileName);

    const zip = await JSZip.loadAsync(await readFile((await download.path())!));
    const xml = await zip.file("word/document.xml")!.async("string");
    const text = xml.replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "");
    for (const expected of [
      "Mutual Non-Disclosure Agreement",
      AGREEMENT.effectiveDateText,
      `Governing Law: ${AGREEMENT.governingLaw}`,
      ...AGREEMENT.parties.flatMap((p) => [p.company, p.name, p.address]),
      "11. General. ",
    ]) {
      expect(text).toContain(expected);
    }
    await expect(page.getByRole("button", { name: "Download Word" })).toBeEnabled();
  });

  test("Download PDF opens the print dialog", async ({ page }) => {
    let prints = 0;
    await page.exposeFunction("recordPrint", () => prints++);
    await page.addInitScript(() => {
      window.print = () => (window as unknown as { recordPrint: () => void }).recordPrint();
    });
    await openApp(page);
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect.poll(() => prints).toBe(1);
  });

  test("prints only the agreement, across several pages", async ({ page }) => {
    await openApp(page);
    await fillForm(page);
    await page.emulateMedia({ media: "print" });

    await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeHidden();
    await expect(page.getByLabel(/^Purpose/)).toBeHidden();
    await expect(preview(page).getByRole("heading", { name: "Mutual Non-Disclosure Agreement" })).toBeVisible();

    // Generate the real PDF. The cover page and the Standard Terms need at least two Letter pages.
    const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true });
    const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  test("has no detectable accessibility violations @mobile", async ({ page }) => {
    await openApp(page);
    const scan = async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
    };
    expect(await scan(), "empty form").toEqual([]);

    await fillForm(page);
    await page.getByLabel("Continues until terminated").check(); // includes the disabled years box
    expect(await scan(), "filled form").toEqual([]);
  });

  test("moves through the controls in order with the Tab key", async ({ page }) => {
    await openApp(page);
    // Start from the top of the page, as a keyboard user would.
    await page.locator("body").focus();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Download Word" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/^Purpose/)).toBeFocused();

    // Typing and tabbing between fields fills the agreement.
    await page.getByLabel(/^Governing Law/).focus();
    await page.keyboard.type("Texas");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(/^Jurisdiction/)).toBeFocused();
    await page.keyboard.type("Austin, TX");
    await expect(preview(page).getByText("Governing Law: Texas")).toBeVisible();
    await expect(preview(page).getByText("Jurisdiction: Austin, TX")).toBeVisible();

    // Radio options can be changed with the arrow keys.
    await page.getByLabel(/^Expires/).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByLabel("Continues until terminated")).toBeChecked();
  });

  test("keeps the form state while editing other fields", async ({ page }) => {
    await openApp(page);
    await partyGroup(page, 1).getByLabel("Company").fill("Acme Inc.");
    await page.getByLabel("Continues until terminated").check();
    await partyGroup(page, 2).getByLabel("Company").fill("Globex");
    await expect(partyGroup(page, 1).getByLabel("Company")).toHaveValue("Acme Inc.");
    await expect(page.getByLabel("Continues until terminated")).toBeChecked();
  });
});

test.describe("layout @mobile", () => {
  test("puts the form beside the preview on desktop and above it on mobile, without sideways scrolling", async ({
    page,
    isMobile,
  }) => {
    await openApp(page);
    const form = await page.getByRole("button", { name: "Download PDF" }).boundingBox();
    const doc = await preview(page).boundingBox();
    expect(form).not.toBeNull();
    expect(doc).not.toBeNull();

    if (isMobile) {
      expect(doc!.y).toBeGreaterThan(form!.y);
    } else {
      expect(doc!.x).toBeGreaterThan(form!.x);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
