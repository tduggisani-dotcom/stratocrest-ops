import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
// Cloud sessions ship an older Chromium than Playwright expects; CI installs the matching one.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
// Signed-in browser state per project, written by tests/e2e/global-setup.ts (git-ignored).
const authState = (project: string) =>
  path.join(import.meta.dirname, ".tmp", "e2e", `auth-${project}.json`)

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "America/New_York",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        storageState: authState("desktop"),
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        storageState: authState("mobile"),
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        url: `${baseURL}/sign-in`,
        // Sign-in emails link to NEXT_PUBLIC_SITE_URL (inlined at build time), so point it here.
        env: { NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
})
