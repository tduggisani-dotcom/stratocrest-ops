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

/** The smallest tap target allowed on phones (CLAUDE.md: tap targets ≥ 44 px). */
export const MIN_TAP = 44

const TAP_TARGETS = [
  "a:visible",
  "button:visible",
  "summary:visible",
  "input:visible",
  "select:visible",
  "textarea:visible",
].join(", ")

/**
 * Links, buttons, disclosure summaries and form controls in `scope` smaller than a 44 × 44 px
 * tap target, as readable messages (empty when all are big enough). Measured as a finger meets
 * them: a "stretched" link (its ::after covers a card) by the card, and a radio button or
 * checkbox by its <label>.
 */
export async function smallTapTargets(scope: Locator): Promise<string[]> {
  return scope.locator(TAP_TARGETS).evaluateAll(
    (elements, min) =>
      elements
        .map((element) => {
          let target: Element = element
          const after = getComputedStyle(element, "::after")
          if (
            element instanceof HTMLElement &&
            after.position === "absolute" &&
            after.content !== "none" &&
            after.content !== "normal" &&
            element.offsetParent
          ) {
            target = element.offsetParent
          } else if (
            element instanceof HTMLInputElement &&
            (element.type === "radio" || element.type === "checkbox")
          ) {
            target = element.closest("label") ?? element
          }
          const box = target.getBoundingClientRect()
          const name =
            element.getAttribute("aria-label") ??
            (element.textContent?.trim() ||
              (element.id &&
                document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent) ||
              element.getAttribute("name") ||
              element.tagName)
          return { name: name.trim(), height: box.height, width: box.width }
        })
        // Round: at 3× pixel density a 44 px box can measure 43.99998.
        .filter((target) => Math.round(target.height) < min || Math.round(target.width) < min)
        .map((t) => `"${t.name}" is ${Math.round(t.width)} × ${Math.round(t.height)} px`),
    MIN_TAP,
  )
}

/**
 * Tap targets in `scope` that stick out past the left or right edge of the screen: the page
 * itself doesn't scroll, but a row that scrolls (or clips) inside itself hides them.
 */
export async function offScreenTapTargets(scope: Locator): Promise<string[]> {
  return scope.locator(TAP_TARGETS).evaluateAll((elements) =>
    elements
      .map((element) => {
        const box = element.getBoundingClientRect()
        const name =
          element.getAttribute("aria-label") ??
          (element.textContent?.trim() || element.getAttribute("name") || element.tagName)
        return { name: name.trim(), left: box.left, right: box.right }
      })
      .filter((t) => Math.round(t.left) < 0 || Math.round(t.right) > window.innerWidth)
      .map((t) => `"${t.name}" spans ${Math.round(t.left)}–${Math.round(t.right)} px`),
  )
}
