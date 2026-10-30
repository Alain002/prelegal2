import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import JSZip from "jszip";
import {
  AGREEMENT,
  conversation,
  expect,
  expectHttpErrors,
  expectNoAxeViolations,
  fakeAi,
  fillByChat,
  openApp,
  PILOT,
  preview,
  say,
  signInWithForm,
  signUpViaApi,
  test,
} from "./helpers";

const savedList = (page: Page) => page.getByRole("list", { name: "Saved documents" });
const saveStatus = (page: Page) => page.getByTestId("save-status");


/** Drafts the Pilot Agreement by chat and waits until it is saved. Returns its saved id. */
async function draftPilot(page: Page) {
  await fillByChat(page, PILOT.draft);
  await expect(saveStatus(page)).toHaveText("All changes saved to My documents.");
  await expect(page).toHaveURL(/\/draft\/\?id=\d+$/);
  return Number(new URL(page.url()).searchParams.get("id"));
}

test.describe("my documents", () => {
  test("a new user has none yet, and is invited to draft one @mobile", async ({ page }) => {
    await openApp(page);
    await page.getByRole("link", { name: "My documents" }).click();
    await expect(page).toHaveURL("/documents/");
    await expect(page).toHaveTitle("My documents | Prelegal");
    await expect(page.getByRole("heading", { name: "No documents yet" })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole("link", { name: "Draft your first agreement" }).click();
    await expect(page).toHaveURL("/draft/");
  });

  test("saves a draft as soon as the assistant picks the document, and lists it", async ({ page }) => {
    await openApp(page);
    await expect(saveStatus(page)).toHaveText("Saved automatically once the assistant picks your document.");
    await draftPilot(page);

    await page.getByRole("link", { name: "My documents" }).click();
    const row = savedList(page).getByRole("listitem");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Acme Inc. / Globex LLC");
    await expect(row).toContainText("Pilot Agreement");
    await expect(row).toContainText("Last edited");
    await expectNoAxeViolations(page);
  });

  test("reopens a document with its preview and conversation, and keeps saving to it @mobile", async ({ page }) => {
    await openApp(page);
    const id = await draftPilot(page);
    await page.getByRole("link", { name: "My documents" }).click();

    await page.getByRole("link", { name: "Open Acme Inc. / Globex LLC" }).click();
    await expect(page).toHaveURL(`/draft/?id=${id}`);
    await expect(preview(page).getByRole("heading", { level: 1, name: "Pilot Agreement" })).toBeVisible();
    await expect(conversation(page).getByText("Here are all the details.")).toBeVisible();
    await expect(conversation(page).getByText("All done! You can download it now.")).toBeVisible();
    await expectNoAxeViolations(page);

    // Carry on: the AI switches to the NDA, which updates the same saved document.
    const requests = await fakeAi(page, { reply: "Switched to an NDA.", draft: AGREEMENT.draft });
    await say(page, "Make it an NDA instead.", "Switched to an NDA.");
    // The restored conversation went to the AI with the new message.
    expect(requests[0].messages.map((m) => m.content)).toContain("Here are all the details.");
    await expect(saveStatus(page)).toHaveText("All changes saved to My documents.");

    await page.goto("/documents/");
    const row = savedList(page).getByRole("listitem");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Mutual Non-Disclosure Agreement");
  });

  test("a reload of a new draft's page reopens it, saved under one document", async ({ page }) => {
    await openApp(page);
    const id = await draftPilot(page);
    await fakeAi(page, { reply: "Noted, 60 days.", draft: { ...PILOT.draft, fields: { ...PILOT.draft.fields, pilotPeriod: "60 days" } } });
    await say(page, "Make it 60 days.", "Noted, 60 days.");
    await expect(saveStatus(page)).toHaveText("All changes saved to My documents.");
    // The page stayed as it was through the first save: the conversation is all there.
    await expect(conversation(page).getByText("Here are all the details.")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(`/draft/?id=${id}`);
    await expect(preview(page)).toContainText("60 days");
    await expect(conversation(page).getByText("Noted, 60 days.")).toBeVisible();

    await page.goto("/documents/");
    await expect(savedList(page).getByRole("listitem")).toHaveCount(1);
  });

  test("New document starts afresh from a saved one", async ({ page }) => {
    await openApp(page);
    await draftPilot(page);

    await page.getByRole("link", { name: "New document" }).click();
    await expect(page).toHaveURL("/draft/");
    await expect(preview(page).getByRole("heading", { name: "Your agreement will appear here" })).toBeVisible();
    await expect(conversation(page).getByText("Here are all the details.")).toHaveCount(0);
  });

  test("deletes a document after confirming", async ({ page }) => {
    await openApp(page);
    await draftPilot(page);
    await page.goto("/documents/");

    await page.getByRole("button", { name: "Delete Acme Inc. / Globex LLC" }).click();
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Confirm delete Acme Inc. / Globex LLC" }).click();
    await expect(page.getByRole("heading", { name: "No documents yet" })).toBeVisible();
  });

  test("says when a document can't be found", async ({ page, consoleErrors }) => {
    await openApp(page);
    await page.goto("/draft/?id=999999");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("We couldn't find that document. It may have been deleted.");
    await expectNoAxeViolations(page);
    await page.getByRole("main").getByRole("link", { name: "My documents" }).click();
    await expect(page).toHaveURL("/documents/");
    // Chromium logs the 404 as a console error.
    expectHttpErrors(consoleErrors, 404);
  });

  test("keeps each user's documents private, and there after signing back in", async ({ page, browser }) => {
    const email = await openApp(page);
    const id = await draftPilot(page);

    const other = await browser.newPage();
    await signUpViaApi(other);
    await other.goto("/documents/");
    await expect(other.getByRole("heading", { name: "No documents yet" })).toBeVisible();
    expect((await other.request.get(`/api/documents/${id}`)).status()).toBe(404);
    await other.close();

    await page.getByRole("button", { name: "Sign out" }).click();
    await signInWithForm(page, email);
    await expect(page).toHaveURL("/draft/");
    await page.goto("/documents/");
    await expect(savedList(page).getByRole("listitem")).toHaveCount(1);
  });
});

test.describe("draft notice", () => {
  test("is on the agreement in the preview and when printed", async ({ page }) => {
    await openApp(page);
    await fillByChat(page, PILOT.draft);
    const notice = preview(page).getByRole("complementary", { name: "Draft notice" });
    await expect(notice).toContainText("Draft: subject to legal review");
    await expect(notice).toContainText("It is not legal advice.");

    await page.emulateMedia({ media: "print" });
    await expect(notice).toBeVisible();
    await expect(page.getByText("Draft generated by Prelegal. Not legal advice")).toBeHidden();
  });

  test("is in the footer of every page of the platform", async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole("contentinfo")).toContainText("Not legal advice: subject to review by a qualified lawyer.");
    await page.goto("/documents/");
    await expect(page.getByRole("contentinfo")).toContainText("Not legal advice");
  });

  test("is in the Word file, under the title and in the page footers", async ({ page }) => {
    await openApp(page);
    await fillByChat(page, PILOT.draft);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Word" }).click(),
    ]);
    const zip = await JSZip.loadAsync(await readFile((await download.path())!));
    const text = async (name: string) => (await zip.file(name)!.async("string")).replace(/<[^>]+>/g, "");
    expect(await text("word/document.xml")).toContain("DRAFT: SUBJECT TO LEGAL REVIEW");
    const footers = Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/.test(name));
    expect(footers.length).toBeGreaterThan(0);
    expect(await text(footers[0])).toContain("Not legal advice");
  });
});
