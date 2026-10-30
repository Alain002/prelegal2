import {
  expect,
  expectHttpErrors,
  expectNoAxeViolations,
  openApp,
  PASSWORD,
  signInWithForm,
  signUpViaApi,
  signUpWithForm,
  test,
  uniqueEmail,
} from "./helpers";

test.describe("accounts", () => {
  test("creates an account and lands on the drafting page @mobile", async ({ page, isMobile }) => {
    const email = uniqueEmail();
    await page.goto("/");
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL("/signup/");
    await expect(page).toHaveTitle("Create your account | Prelegal");

    await signUpWithForm(page, email);

    await expect(page).toHaveURL("/draft/");
    await expect(page.getByRole("heading", { name: "Draft an agreement" })).toBeVisible();
    // Phones have no room for the email in the header.
    if (!isMobile) await expect(page.getByText(email)).toBeVisible();
  });

  test("signs in again with the same email and password @mobile", async ({ page }) => {
    const email = await signUpViaApi(page);
    await page.context().clearCookies();

    await page.goto("/");
    await expect(page).toHaveTitle("Sign in | Prelegal");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    await signInWithForm(page, email.toUpperCase());

    await expect(page).toHaveURL("/draft/");
  });

  test("says when the password is wrong, and stays on the sign-in page", async ({ page, consoleErrors }) => {
    const email = await signUpViaApi(page);
    await page.context().clearCookies();
    await page.goto("/");

    await signInWithForm(page, email, "not the password");

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");
    await expect(page).toHaveURL("/");
    expectHttpErrors(consoleErrors, 401);
  });

  test("says when the email already has an account", async ({ page, consoleErrors }) => {
    const email = await signUpViaApi(page);
    await page.context().clearCookies();
    await page.goto("/signup/");

    await signUpWithForm(page, email);

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("An account with this email already exists. Sign in instead.");
    await expect(page).toHaveURL("/signup/");
    expectHttpErrors(consoleErrors, 409);
  });

  test("lets the browser check the fields before anything is sent", async ({ page }) => {
    await page.goto("/signup/");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/signup/");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("sends signed-out visitors from the platform's pages to the sign-in page", async ({ page }) => {
    for (const path of ["/draft/", "/documents/", "/draft/?id=1"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
    }
  });

  test("stays signed in across reloads and skips the sign-in page", async ({ page }) => {
    await openApp(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Draft an agreement" })).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL("/draft/");
  });

  test("signs out back to the sign-in page, and the session is gone", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/");
    await page.goto("/draft/");
    await expect(page).toHaveURL("/");
    const me = await page.request.get("/api/auth/me");
    expect(await me.json()).toEqual({ user: null });
  });

  test("keeps the session in an httpOnly cookie that scripts can't read", async ({ page }) => {
    await openApp(page);
    const [cookie] = (await page.context().cookies()).filter((c) => c.name === "prelegal_session");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("prelegal_session");
  });

  test("shows the legal disclaimer on the sign-in and sign-up pages", async ({ page }) => {
    for (const path of ["/", "/signup/"]) {
      await page.goto(path);
      await expect(page.getByRole("complementary", { name: "Legal disclaimer" })).toContainText(
        "Draft: subject to legal review",
      );
    }
  });

  test("the sign-in and sign-up pages have no detectable accessibility violations @mobile", async ({ page }) => {
    await page.goto("/");
    await expectNoAxeViolations(page);
    await page.goto("/signup/");
    await expectNoAxeViolations(page);
  });

  test("the sign-in error has no detectable accessibility violations", async ({ page, consoleErrors }) => {
    await page.goto("/");
    await signInWithForm(page, uniqueEmail(), PASSWORD);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expectNoAxeViolations(page);
    expectHttpErrors(consoleErrors, 401);
  });
});

test.describe("backend", () => {
  test("serves the health check", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("refuses the AI chat and saved documents to signed-out callers", async ({ request }) => {
    const chat = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "Hi" }], draft: { documentId: null, fields: {} } },
    });
    expect(chat.status()).toBe(401);
    expect((await request.get("/api/documents")).status()).toBe(401);
  });

  test("redirects page URLs without a trailing slash", async ({ page }) => {
    await openApp(page);
    await page.goto("/draft");
    await expect(page).toHaveURL("/draft/");
  });

  // Uses `request` rather than a page: the browser logs every 404 as a console error.
  test("serves the not found page for unknown pages", async ({ request }) => {
    const response = await request.get("/no-such-page/");
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain("404");
  });
});
