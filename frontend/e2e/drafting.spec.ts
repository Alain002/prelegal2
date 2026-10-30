import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import type { Page } from "@playwright/test";
import {
  AGREEMENT,
  chatPanel,
  conversation,
  expect,
  fakeAi,
  fillByChat,
  messageBox,
  openApp,
  PILOT,
  preview,
  say,
  test,
} from "./helpers";

const GREETING = /Hi! I can help you draft a legal agreement/;

/** Clicks Download Word and returns the file name and the document's text. */
async function downloadWord(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download Word" }).click(),
  ]);
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const xml = await zip.file("word/document.xml")!.async("string");
  return { fileName: download.suggestedFilename(), text: xml.replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "") };
}

test.describe("drafting an agreement", () => {
  test("opens with the assistant's greeting and the list of documents @mobile", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("Draft an agreement | Prelegal");
    await expect(page.getByRole("heading", { name: "Draft an agreement" })).toBeVisible();
    await expect(conversation(page).getByText(GREETING)).toBeVisible();
    const documents = preview(page).getByRole("listitem");
    await expect(documents).toHaveCount(11);
    await expect(documents.first()).toHaveText("Mutual Non-Disclosure Agreement");
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Download Word" })).toBeDisabled();
  });

  test("keeps the list while the assistant works out which document is needed", async ({ page }) => {
    await openApp(page);
    await fakeAi(page, {
      reply: "Prelegal can't draft employment contracts. The closest is a Professional Services Agreement. Would that work?",
      draft: { documentId: null, fields: {} },
    });
    await say(page, "I need an employment contract.", "Would that work?");
    await expect(preview(page).getByRole("heading", { name: "Your agreement will appear here" })).toBeVisible();
  });

  test("picks the NDA and fills it in as the conversation goes", async ({ page }) => {
    await openApp(page);
    // Before the second message, the other party and the governing law are still missing.
    const fields = Object.entries(AGREEMENT.draft.fields).filter(([key]) => key !== "party2Company" && key !== "governingLaw");
    const afterFirst = { documentId: "mutual-nda", fields: Object.fromEntries(fields) };
    const requests = await fakeAi(
      page,
      { reply: "An NDA it is. Who is the other party?", draft: afterFirst },
      { reply: "Got it. Everything is filled in.", draft: AGREEMENT.draft },
    );
    const doc = preview(page);

    await say(page, "An NDA. We are Acme Inc., represented by Ada Lovelace.", "Who is the other party?");
    await expect(doc.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeVisible();
    await expect(doc.getByRole("cell", { name: "Acme Inc." })).toBeVisible();
    await expect(doc.getByText("Governing Law: [Governing Law]")).toBeVisible();

    await say(page, "Globex, LLC. Delaware law.", "Got it. Everything is filled in.");
    await expect(doc.getByRole("cell", { name: "Globex, LLC" })).toBeVisible();
    await expect(doc.getByText("Governing Law: Delaware")).toBeVisible();

    // Each message carries the whole conversation, the draft as it stood, and the user's date.
    expect(requests[0].draft).toEqual({ documentId: null, fields: {} });
    expect(requests[1].messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant", "user"]);
    expect(requests[1].messages.at(-1)?.content).toBe("Globex, LLC. Delaware law.");
    expect(requests[1].draft).toEqual(afterFirst);
    const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
    expect(requests[1].today).toBe(today);
    await expect(messageBox(page)).toHaveValue("");
  });

  test("shows every detail of the NDA", async ({ page }) => {
    await openApp(page);
    await fillByChat(page);
    const doc = preview(page);
    const f = AGREEMENT.draft.fields;

    await expect(doc.getByText(f.purpose)).toBeVisible();
    await expect(doc.getByText(AGREEMENT.effectiveDateText)).toBeVisible();
    await expect(doc.getByText("Expires 2 years from Effective Date.")).toBeVisible();
    await expect(doc.getByText(/^3 years from Effective Date, but/)).toBeVisible();
    await expect(doc.getByText(`Governing Law: ${f.governingLaw}`)).toBeVisible();
    await expect(doc.getByText(`Jurisdiction: ${f.chosenCourts}`)).toBeVisible();
    await expect(doc.getByText(/^Section 8 does not apply\./)).toHaveText(f.modifications);
    await expect(doc.getByRole("listitem")).toHaveCount(11);

    const table = doc.getByRole("table");
    for (const n of [1, 2] as const) {
      for (const detail of ["Company", "Name", "Title", "NoticeAddress"]) {
        const value = f[`party${n}${detail}` as keyof typeof f];
        await expect(table.getByRole("cell", { name: value.split("\n")[0] })).toHaveText(value);
      }
    }
  });

  test("drafts other documents with a generated cover page and the full Standard Terms", async ({ page }) => {
    await openApp(page);
    await fillByChat(page, PILOT.draft);
    const doc = preview(page);

    await expect(doc.getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeVisible();
    await expect(doc.getByText("Provider: Acme Inc.")).toBeVisible();
    await expect(doc.getByText("Customer: Globex LLC")).toBeVisible();
    await expect(doc.getByRole("heading", { level: 3, name: "Pilot Period" })).toBeVisible();
    await expect(doc.getByText("90 days")).toBeVisible();
    await expect(doc.getByText("November 1, 2026")).toBeVisible();
    // An optional term that wasn't filled in.
    await expect(doc.getByRole("heading", { level: 3, name: "Fees" }).locator("+ p")).toHaveText("None");
    await expect(doc.getByRole("columnheader", { name: "PROVIDER" })).toBeVisible();
    await expect(doc.getByRole("heading", { level: 3, name: "1. Pilot Access" })).toBeVisible();
    await expect(doc.getByRole("heading", { level: 3, name: "8. Definitions" })).toBeVisible();

    const word = await downloadWord(page);
    expect(word.fileName).toBe(PILOT.fileName);
    for (const expected of ["Pilot Agreement", "Provider: Acme Inc.", "90 days", "Ada Lovelace", "1. Pilot Access", "2.1 ", "Changes: Prelegal added this Cover Page"]) {
      expect(word.text).toContain(expected);
    }
  });

  test("switches document mid-conversation", async ({ page }) => {
    await openApp(page);
    const nda = { documentId: "mutual-nda", fields: { party1Company: "Acme Inc.", party2Company: "Globex LLC" } };
    const requests = await fakeAi(
      page,
      { reply: "A Pilot Agreement, then.", draft: PILOT.draft },
      { reply: "Switched to the NDA.", draft: nda },
    );
    await say(page, "A pilot for Globex.", "A Pilot Agreement, then.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeVisible();

    await say(page, "Actually we need an NDA first.", "Switched to the NDA.");
    await expect(preview(page).getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" })).toBeVisible();
    await expect(preview(page).getByRole("cell", { name: "Globex LLC" })).toBeVisible();
    expect(requests[1].draft).toEqual(PILOT.draft);
  });

  test("shows an error when the AI is unavailable, and Try again recovers", async ({ page, consoleErrors }) => {
    await openApp(page);
    await fakeAi(
      page,
      { status: 502, detail: "The AI assistant is unavailable right now. Please try again." },
      { reply: "Thanks! Who signs for Acme?", draft: AGREEMENT.draft },
    );

    await say(page, "An NDA for Acme Inc.");
    await expect(chatPanel(page).getByRole("alert")).toContainText("The AI assistant is unavailable right now.");
    // The browser logs the failed request itself; that one is expected.
    expect(consoleErrors).toEqual([expect.stringContaining("502")]);
    consoleErrors.length = 0;

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(conversation(page).getByText("Thanks! Who signs for Acme?")).toBeVisible();
    await expect(chatPanel(page).getByRole("alert")).toHaveCount(0);
    await expect(conversation(page).getByText("An NDA for Acme Inc.")).toHaveCount(1);
    await expect(preview(page).getByRole("cell", { name: "Acme Inc." })).toBeVisible();
  });

  test("shows that the assistant is typing", async ({ page }) => {
    await openApp(page);
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await page.route("**/api/chat", async (route) => {
      await answered;
      await route.fulfill({ json: { reply: "Done.", draft: AGREEMENT.draft } });
    });

    await say(page, "Hello");
    await expect(page.getByRole("status")).toHaveText("Assistant is typing…");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();

    answer();
    await expect(conversation(page).getByText("Done.")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("downloads a complete NDA as a Word document", async ({ page }) => {
    await openApp(page);
    await fillByChat(page);

    const word = await downloadWord(page);
    expect(word.fileName).toBe(AGREEMENT.fileName);
    const f = AGREEMENT.draft.fields;
    for (const expected of [
      "Mutual Non-Disclosure Agreement",
      AGREEMENT.effectiveDateText,
      `Governing Law: ${f.governingLaw}`,
      f.party1Company,
      f.party2Name,
      f.party2NoticeAddress,
      "11. General. ",
    ]) {
      expect(word.text).toContain(expected);
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
    await fillByChat(page, PILOT.draft);
    await page.getByRole("button", { name: "Download PDF" }).click();
    await expect.poll(() => prints).toBe(1);
  });

  for (const [name, draft, title] of [
    ["the NDA", AGREEMENT.draft, "Mutual Non-Disclosure Agreement"],
    ["a generated document", PILOT.draft, "Pilot Agreement"],
  ] as const) {
    test(`prints only ${name}, across several pages`, async ({ page }) => {
      await openApp(page);
      await fillByChat(page, draft);
      await page.emulateMedia({ media: "print" });

      await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeHidden();
      await expect(page.getByRole("heading", { name: "Draft an agreement" })).toBeHidden();
      await expect(conversation(page)).toBeHidden();
      await expect(preview(page).getByRole("heading", { level: 1, name: title })).toBeVisible();

      // Generate the real PDF. The cover page and the Standard Terms need at least two Letter pages.
      const pdf = await page.pdf({ format: "Letter", preferCSSPageSize: true });
      const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
      expect(pages.length).toBeGreaterThanOrEqual(2);
    });
  }

  test("has no detectable accessibility violations @mobile", async ({ page }) => {
    await openApp(page);
    const scan = async () => {
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
    };
    expect(await scan(), "new conversation").toEqual([]);

    await fakeAi(page, { reply: "An NDA.", draft: AGREEMENT.draft }, { reply: "A pilot.", draft: PILOT.draft });
    await say(page, "An NDA", "An NDA.");
    expect(await scan(), "the NDA").toEqual([]);
    await say(page, "A pilot", "A pilot.");
    expect(await scan(), "a generated document").toEqual([]);
  });

  test("moves through the controls in order with the Tab key, and Enter sends", async ({ page }) => {
    await openApp(page);
    await fakeAi(page, { reply: "Thanks!", draft: AGREEMENT.draft });
    // Start from the top of the page, as a keyboard user would. The downloads are disabled
    // until there is a document, so they are skipped.
    await page.locator("body").focus();

    for (const control of [page.getByRole("button", { name: "Sign out" }), messageBox(page)]) {
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
    }

    await page.keyboard.type("We are Acme Inc.");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Second line");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Send" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(conversation(page).getByText("Thanks!")).toBeVisible();
    await expect(conversation(page).getByText(/We are Acme Inc\.\s+Second line/)).toBeVisible();
    await expect(messageBox(page)).toBeFocused();

    // With a document, the downloads come between Sign out and the message box.
    for (const control of [
      page.getByRole("button", { name: "Download Word" }),
      page.getByRole("button", { name: "Download PDF" }),
      page.getByRole("button", { name: "Sign out" }),
    ]) {
      await page.keyboard.press("Shift+Tab");
      await expect(control).toBeFocused();
    }
  });
});

test.describe("layout @mobile", () => {
  test("puts the chat beside the preview on desktop and above it on mobile, without sideways scrolling", async ({
    page,
    isMobile,
  }) => {
    await openApp(page);
    await fillByChat(page, PILOT.draft);
    const chat = await messageBox(page).boundingBox();
    const doc = await preview(page).boundingBox();
    expect(chat).not.toBeNull();
    expect(doc).not.toBeNull();

    if (isMobile) {
      expect(doc!.y).toBeGreaterThan(chat!.y);
    } else {
      expect(doc!.x).toBeGreaterThan(chat!.x);
      // The message box stays on screen without scrolling the page.
      expect(chat!.y + chat!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
