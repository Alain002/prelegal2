import AxeBuilder from "@axe-core/playwright";
import { expect, signInWithForm, TEST_EMAIL, test } from "./helpers";

test.describe("fake sign in", () => {
  test("signs in with any email and password and lands in the NDA creator @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Sign in | Prelegal");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    await signInWithForm(page);

    await expect(page).toHaveURL("/nda/");
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("requires an email and a password", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
  });

  test("sends signed-out visitors from the NDA creator to the sign-in page", async ({ page }) => {
    await page.goto("/nda/");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
  });

  test("stays signed in across reloads and skips the sign-in page", async ({ page }) => {
    await page.goto("/");
    await signInWithForm(page);
    await expect(page).toHaveURL("/nda/");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator" })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL("/nda/");
  });

  test("signs out back to the sign-in page", async ({ page }) => {
    await page.goto("/");
    await signInWithForm(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/");
    await page.goto("/nda/");
    await expect(page).toHaveURL("/");
  });

  test("the sign-in page has no detectable accessibility violations @mobile", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe("backend", () => {
  test("serves the health check", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("redirects page URLs without a trailing slash", async ({ page }) => {
    await page.goto("/");
    await signInWithForm(page);
    await page.goto("/nda");
    await expect(page).toHaveURL("/nda/");
  });

  // Uses `request` rather than a page: the browser logs every 404 as a console error.
  test("serves the not found page for unknown pages", async ({ request }) => {
    const response = await request.get("/no-such-page/");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("404");
  });
});
