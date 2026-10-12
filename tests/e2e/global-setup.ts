import { mkdirSync, statSync } from "node:fs"
import path from "node:path"
import { chromium, type BrowserContextOptions, type FullConfig, type Page } from "@playwright/test"
import { signInWithCode } from "./support/auth"
import { teammateFor, type Teammate } from "./support/team"

/**
 * Signs in once per project (desktop and mobile, as different teammates) by the real email-code
 * flow, and saves the browser state to the project's `storageState` file. Most specs start from
 * that state, so a run sends only a handful of sign-in emails.
 *
 * Supabase allows about 30 sign-in emails per 5 minutes, so outside CI a state saved in the last
 * REUSE_MINUTES is reused if it still works. (Its access token lasts an hour, so it can't expire
 * mid-run and trigger refresh-token rotation between tests.)
 *
 * Runs after Playwright has started the web server.
 */
const REUSE_MINUTES = 20

export default async function globalSetup(config: FullConfig) {
  for (const project of config.projects) {
    const { storageState, baseURL, viewport, deviceScaleFactor, isMobile, hasTouch } = project.use
    if (typeof storageState !== "string") continue

    const person = await teammateFor(project.name, "session")
    const contextOptions: BrowserContextOptions = {
      baseURL,
      viewport,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      timezoneId: project.use.timezoneId,
    }
    const browser = await chromium.launch(project.use.launchOptions)
    try {
      if (!process.env.CI && savedRecently(storageState)) {
        const context = await browser.newContext({ ...contextOptions, storageState })
        const stillSignedIn = await greets(await context.newPage(), person)
        await context.close()
        if (stillSignedIn) continue
      }

      const context = await browser.newContext(contextOptions)
      const page = await context.newPage()
      try {
        await signInWithCode(page, person.email)
        await page.getByRole("heading", { level: 1, name: `Hi, ${person.firstName}` }).waitFor()
        mkdirSync(path.dirname(storageState), { recursive: true })
        await context.storageState({ path: storageState })
      } catch (error) {
        const shot = path.resolve("test-results", `setup-${project.name}.png`)
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
        throw new Error(
          `Signing in ${person.email} for the ${project.name} project failed (screenshot: ${shot})`,
          { cause: error },
        )
      }
    } finally {
      await browser.close()
    }
  }
}

function savedRecently(file: string): boolean {
  try {
    return Date.now() - statSync(file).mtimeMs < REUSE_MINUTES * 60_000
  } catch {
    return false
  }
}

/** True when This Week loads and greets `person`. */
async function greets(page: Page, person: Teammate) {
  await page.goto("/")
  return page
    .getByRole("heading", { level: 1, name: `Hi, ${person.firstName}` })
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false)
}
