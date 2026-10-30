import { test as base, expect, type Page } from "@playwright/test";
import type { ChatMessage } from "../src/lib/chat/api";
import type { NdaValues } from "../src/lib/nda/types";

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

export const TEST_EMAIL = "ada@acme.test";

/** Fills in and submits the sign-in form, which accepts any email and password. */
export async function signInWithForm(page: Page, email = TEST_EMAIL) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("anything");
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in, opens the NDA creator and waits until the Effective Date default has been applied. */
export async function openApp(page: Page) {
  await page.goto("/");
  await signInWithForm(page);
  await expect(page).toHaveURL("/nda/");
  await expect(messageBox(page)).toBeVisible();
  await expect(preview(page).getByText("[Effective Date]")).toHaveCount(0);
}

/** A complete agreement, as the (fake) AI fills it in, and what the preview should then show. */
export const AGREEMENT = {
  values: {
    purpose: "Evaluating a joint product launch.",
    effectiveDate: "2026-11-15",
    mndaTerm: { kind: "expires", years: 2 },
    confidentialityTerm: { kind: "years", years: 5 },
    governingLaw: "Delaware",
    jurisdiction: "courts located in New Castle, DE",
    modifications: "Section 8 does not apply.\nNotices by email only.",
    parties: [
      { company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" },
      { company: "Globex, LLC", name: "Alan Turing", title: "CTO", noticeAddress: "1 Main St\nWilmington, DE 19801" },
    ],
  } satisfies NdaValues,
  effectiveDateText: "November 15, 2026",
  fileName: "Mutual-NDA-Acme-Inc-Globex-LLC.docx",
};

export type ChatRequest = { messages: ChatMessage[]; values: NdaValues };

/** What the fake AI does with one request: answer, or fail with an HTTP status. */
type FakeAnswer = { reply: string; values: NdaValues } | { status: number; detail: string };

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

/** Has the fake AI fill in the whole agreement with `AGREEMENT` in one message. */
export async function fillByChat(page: Page) {
  await fakeAi(page, { reply: "All done! You can download your NDA now.", values: AGREEMENT.values });
  await say(page, "Here are all the details.", "All done! You can download your NDA now.");
}
