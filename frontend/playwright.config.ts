import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

// Locally, use the installed Google Chrome. On CI (or with PW_CHANNEL=chromium), use
// Playwright's bundled browser: run `npx playwright install --with-deps chromium` first.
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? "chromium" : "chrome");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Every test runs on desktop; tests tagged @mobile also run on a phone-sized screen.
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, grep: /@mobile/ },
  ],
  // Test the production build, the same output that gets deployed. A fresh build and
  // server every run, so the tests never hit a stale server left on the port. Set
  // PW_REUSE=1 to reuse a server you started yourself (faster when iterating).
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: process.env.PW_REUSE === "1",
  },
});
