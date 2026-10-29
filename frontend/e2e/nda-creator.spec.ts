import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import {
  AGREEMENT,
  chatPanel,
  conversation,
  expect,
  fakeAi,
  fillByChat,
  messageBox,
  openApp,
  preview,
  say,
  test,
} from "./helpers";

const GREETING = /Hi! I'll help you draft a Mutual Non-Disclosure Agreement/;

test.describe("Mutual NDA Creator", () => {
  test("opens with the assistant's greeting and a default agreement @mobile", async ({ page }) => {
    await openApp(page);

    await expect(page).toHaveTitle("Mutual NDA Creator | Prelegal");
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();
    await expect(conversation(page).getByText(GREETING)).toBeVisible();

    const doc = preview(page);
    await expect(
      doc.getByText("Evaluating whether to enter into a business relationship with the other party."),
    ).toBeVisible();
    // Today's date, in the browser's timezone.
    const today = await page.evaluate(() =>
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    );
    await expect(doc.getByText(today)).toBeVisible();
    await expect(doc.getByText("Expires 1 year from Effective Date.")).toBeVisible();
    await expect(doc.getByText("Governing Law: [Governing Law]")).toBeVisible();
    await expect(doc.getByRole("listitem")).toHaveCount(11);
  });

  test("fills in the agreement as the conversation goes", async ({ page }) => {
    await openApp(page);
    const afterFirst = {
      ...AGREEMENT.values,
      governingLaw: "",
      parties: [AGREEMENT.values.parties[0], { company: "", name: "", title: "", noticeAddress: "" }],
    } satisfies typeof AGREEMENT.values;
    const requests = await fakeAi(
      page,
      { reply: "Thanks! Who is the other party?", values: afterFirst },
      { reply: "Got it. Everything is filled in.", values: AGREEMENT.values },
    );
    const doc = preview(page);

    await say(page, "We are Acme Inc., represented by Ada Lovelace.", "Thanks! Who is the other party?");
    await expect(doc.getByRole("cell", { name: "Acme Inc." })).toBeVisible();
    await expect(doc.getByText("Governing Law: [Governing Law]")).toBeVisible();

    await say(page, "Globex, LLC. Delaware law.", "Got it. Everything is filled in.");
    await expect(doc.getByRole("cell", { name: "Globex, LLC" })).toBeVisible();
    await expect(doc.getByText("Governing Law: Delaware")).toBeVisible();

    // Each message carries the whole conversation and the agreement as it stood.
    expect(requests[1].messages.map((m) => m.role)).toEqual(["assistant", "user", "assistant", "user"]);
    expect(requests[1].messages.at(-1)?.content).toBe("Globex, LLC. Delaware law.");
    expect(requests[1].values).toEqual(afterFirst);
    await expect(messageBox(page)).toHaveValue("");
  });

  test("shows every detail the AI filled in", async ({ page }) => {
    await openApp(page);
    await fillByChat(page);
    const doc = preview(page);
    const v = AGREEMENT.values;

    await expect(doc.getByText(v.purpose)).toBeVisible();
    await expect(doc.getByText(AGREEMENT.effectiveDateText)).toBeVisible();
    await expect(doc.getByText("Expires 2 years from Effective Date.")).toBeVisible();
    await expect(doc.getByText(/^5 years from Effective Date, but/)).toBeVisible();
    await expect(doc.getByText(`Governing Law: ${v.governingLaw}`)).toBeVisible();
    await expect(doc.getByText(`Jurisdiction: ${v.jurisdiction}`)).toBeVisible();
    await expect(doc.getByText(/^Section 8 does not apply\./)).toHaveText(v.modifications);

    const table = doc.getByRole("table");
    for (const p of v.parties) {
      for (const value of [p.company, p.name, p.title, p.noticeAddress]) {
        await expect(table.getByRole("cell", { name: value.split("\n")[0] })).toHaveText(value);
      }
    }
  });

  test("shows an error when the AI is unavailable, and Try again recovers", async ({ page, consoleErrors }) => {
    await openApp(page);
    await fakeAi(
      page,
      { status: 502, detail: "The AI assistant is unavailable right now. Please try again." },
      { reply: "Thanks! Who signs for Acme?", values: AGREEMENT.values },
    );

    await say(page, "We are Acme Inc.");
    await expect(chatPanel(page).getByRole("alert")).toContainText("The AI assistant is unavailable right now.");
    // The browser logs the failed request itself; that one is expected.
    expect(consoleErrors).toEqual([expect.stringContaining("502")]);
    consoleErrors.length = 0;

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(conversation(page).getByText("Thanks! Who signs for Acme?")).toBeVisible();
    await expect(chatPanel(page).getByRole("alert")).toHaveCount(0);
    await expect(conversation(page).getByText("We are Acme Inc.")).toHaveCount(1);
    await expect(preview(page).getByRole("cell", { name: "Acme Inc." })).toBeVisible();
  });

  test("shows that the assistant is typing", async ({ page }) => {
    await openApp(page);
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await page.route("**/api/chat", async (route) => {
      await answered;
      await route.fulfill({ json: { reply: "Done.", values: AGREEMENT.values } });
    });

    await say(page, "Hello");
    await expect(page.getByRole("status")).toHaveText("Assistant is typing…");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();

    answer();
    await expect(conversation(page).getByText("Done.")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("downloads a complete Word document", async ({ page }) => {
    await openApp(page);
    await fillByChat(page);

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
      `Governing Law: ${AGREEMENT.values.governingLaw}`,
      ...AGREEMENT.values.parties.flatMap((p) => [p.company, p.name, p.noticeAddress]),
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
    await fillByChat(page);
    await page.emulateMedia({ media: "print" });

    await expect(page.getByRole("button", { name: "Download PDF" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeHidden();
    await expect(conversation(page)).toBeHidden();
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
    expect(await scan(), "new conversation").toEqual([]);

    await fillByChat(page);
    expect(await scan(), "after a reply").toEqual([]);
  });

  test("moves through the controls in order with the Tab key, and Enter sends", async ({ page }) => {
    await openApp(page);
    await fakeAi(page, { reply: "Thanks!", values: AGREEMENT.values });
    // Start from the top of the page, as a keyboard user would.
    await page.locator("body").focus();

    for (const control of [
      page.getByRole("button", { name: "Sign out" }),
      page.getByRole("button", { name: "Download PDF" }),
      page.getByRole("button", { name: "Download Word" }),
      messageBox(page),
    ]) {
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
  });
});

test.describe("layout @mobile", () => {
  test("puts the chat beside the preview on desktop and above it on mobile, without sideways scrolling", async ({
    page,
    isMobile,
  }) => {
    await openApp(page);
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
