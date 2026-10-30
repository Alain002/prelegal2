import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";
import type { ChatMessage } from "../src/lib/chat/api";
import type { Draft } from "../src/lib/documents/types";
import { ndaDraft, pilotDraft } from "../src/test/drafts";

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
export const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });
export const chatPanel = (page: Page) => page.getByRole("region", { name: "AI assistant" });
export const messageBox = (page: Page) => page.getByLabel("Your message");

export const PASSWORD = "correct horse battery";

/**
 * A fresh email for each test. Tests run in parallel against one backend whose database lives as
 * long as the server, so they must not share accounts.
 */
export function uniqueEmail(name = "ada") {
  return `${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@acme.test`;
}

/** Creates an account through the API. The page's browser context keeps the session cookie. */
export async function signUpViaApi(page: Page, email = uniqueEmail()) {
  const response = await page.request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  expect(response.status(), await response.text()).toBe(201);
  return email;
}

/** Fills in and submits the sign-in form. */
export async function signInWithForm(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Fills in and submits the sign-up form. */
export async function signUpWithForm(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

/**
 * Signs up a new user and waits for the drafting page, where no document has been chosen yet.
 * Returns the user's email.
 */
export async function openApp(page: Page) {
  const email = await signUpViaApi(page);
  await page.goto("/draft/");
  await expect(messageBox(page)).toBeVisible();
  await expect(preview(page).getByRole("heading", { name: "Your agreement will appear here" })).toBeVisible();
  return email;
}

/**
 * Takes the console errors a test expects out of the list checked at the end. Chromium logs every
 * 4xx response as "Failed to load resource", including a deliberately wrong password.
 */
export function expectHttpErrors(consoleErrors: string[], status: number, count = 1) {
  const matches = consoleErrors.filter((e) => e.includes(`status of ${status}`));
  expect(matches, `console errors for HTTP ${status}`).toHaveLength(count);
  consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter((e) => !matches.includes(e)));
}

/** A complete Mutual NDA, as the (fake) AI fills it in, and what the preview should then show. */
export const AGREEMENT = {
  draft: {
    ...ndaDraft,
    fields: { ...ndaDraft.fields, modifications: "Section 8 does not apply.\nNotices by email only." },
  } satisfies Draft,
  effectiveDateText: "November 1, 2026",
  fileName: "Mutual-NDA-Acme-Inc-Globex-LLC.docx",
};

/** A Pilot Agreement with its essential fields filled in: one of the documents with a generated cover page. */
export const PILOT = { draft: pilotDraft, fileName: "Pilot-Agreement-Acme-Inc-Globex-LLC.docx" };

export type ChatRequest = { messages: ChatMessage[]; draft: Draft; today: string };

/** What the fake AI does with one request: answer, or fail with an HTTP status. */
type FakeAnswer = { reply: string; draft: Draft } | { status: number; detail: string };

/**
 * Replaces the AI with scripted answers, one per message, so tests are fast and repeatable.
 * The real backend chat endpoint is covered by the backend's tests. Returns the requests sent.
 */
export async function fakeAi(page: Page, ...answers: FakeAnswer[]) {
  const requests: ChatRequest[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    const answer = answers.shift() ?? { status: 500, detail: "No scripted answer left" };
    if ("status" in answer) {
      await route.fulfill({ status: answer.status, json: { detail: answer.detail } });
    } else {
      await route.fulfill({ json: answer });
    }
  });
  return requests;
}

/** Types a message, sends it with Enter and waits for the reply. */
export async function say(page: Page, text: string, reply?: string) {
  await messageBox(page).fill(text);
  await messageBox(page).press("Enter");
  if (reply) await expect(conversation(page).getByText(reply)).toBeVisible();
}

/** Has the fake AI fill in a whole document (the NDA unless told otherwise) in one message. */
export async function fillByChat(page: Page, draft: Draft = AGREEMENT.draft) {
  await fakeAi(page, { reply: "All done! You can download it now.", draft });
  await say(page, "Here are all the details.", "All done! You can download it now.");
}

/** The page's WCAG 2.1 AA violations found by axe, each with the elements involved. */
export async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}

export async function expectNoAxeViolations(page: Page) {
  expect(await axeViolations(page)).toEqual([]);
}
