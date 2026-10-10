import { mkdirSync } from "node:fs"
import path from "node:path"
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { SCREENSHOTS_DIR } from "./env"

/**
 * Collect console errors and uncaught exceptions from `page`. Check the returned array at the
 * end of a test: `expect(errors).toEqual([])`.
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const { url } = message.location()
    errors.push(`console.error: ${message.text()}${url ? ` (${url})` : ""}`)
  })
  page.on("pageerror", (error) => errors.push(`uncaught: ${error.message}`))
  return errors
}

/** Wait until the page's streamed sections have replaced their loading skeletons. */
export async function waitForContent(page: Page): Promise<void> {
  await expect(page.locator("h1:visible").first()).toBeVisible()
  await expect(page.getByText(/^Loading/)).toHaveCount(0)
}

/** Wait for `locator`'s open/close animations (menus zoom in, sheets slide) to finish. */
export async function animationsDone(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  )
}

/** True when the page scrolls sideways (wider than the viewport). */
export async function scrollsHorizontally(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.documentElement
    return root.scrollWidth > root.clientWidth || document.body.scrollWidth > root.clientWidth
  })
}

/**
 * Save a screenshot for review when E2E_SCREENSHOTS_DIR is set (otherwise nothing happens):
 * <dir>/<project>-<name>.png.
 */
export async function snap(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  if (!SCREENSHOTS_DIR) return
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  // Let animations (menus, sheets) settle first.
  await page.waitForTimeout(400)
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${testInfo.project.name}-${name}.png`),
    fullPage: options.fullPage ?? false,
  })
}
