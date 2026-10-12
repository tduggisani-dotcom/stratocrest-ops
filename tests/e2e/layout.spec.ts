import { expect, test } from "@playwright/test"
import { NAV_ITEMS } from "@/components/shell/nav-config"
import {
  MIN_TAP,
  animationsDone,
  collectConsoleErrors,
  scrollsHorizontally,
  smallTapTargets,
  snap,
  waitForContent,
} from "./support/page"

/** Signed in (global setup). Layout rules from CLAUDE.md: 390 px, no sideways scroll, 44 px taps. */

for (const item of NAV_ITEMS) {
  test(`${item.label} (${item.href}) fits the screen`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === "mobile"
    const errors = collectConsoleErrors(page)
    await page.goto(item.href)
    await waitForContent(page)

    expect(await scrollsHorizontally(page), "the page scrolls sideways").toBe(false)

    if (mobile) {
      const bottomNav = page.getByRole("navigation", { name: "Main" })
      await expect(bottomNav).toBeVisible()
      await expect(bottomNav).toBeInViewport({ ratio: 1 })
      const viewport = page.viewportSize()
      const box = await bottomNav.boundingBox()
      expect(viewport && box && Math.round(box.y + box.height)).toBe(viewport?.height)

      // Top bar, bottom nav, and the page's own links and buttons.
      const topBar = page.locator("header").first()
      expect(await smallTapTargets(topBar)).toEqual([])
      expect(await smallTapTargets(bottomNav)).toEqual([])
      expect(await smallTapTargets(page.locator("main"))).toEqual([])
      // Nothing hides behind the bottom nav once scrolled to the end.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const lastBlock = page.locator("main > *").last()
      const lastBox = await lastBlock.boundingBox()
      const navBox = await bottomNav.boundingBox()
      expect(lastBox && navBox && lastBox.y + lastBox.height <= navBox.y + 1).toBe(true)

      if (item.href === "/tasks") await snap(page, testInfo, "section-tasks", { fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test("the More sheet has full-size tap targets and fits the screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The More sheet is phone-only")
  await page.goto("/")
  await waitForContent(page)
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "More", exact: true })
    .click()
  const sheet = page.getByRole("dialog", { name: "More" })
  await expect(sheet).toBeVisible()
  await animationsDone(sheet)
  await expect(sheet).toBeInViewport({ ratio: 1 })
  expect(await smallTapTargets(sheet)).toEqual([])
  expect(await scrollsHorizontally(page)).toBe(false)
})

test("the account menu has full-size tap targets on phones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "44 px rows are for phones")
  await page.goto("/")
  await waitForContent(page)
  await page.getByRole("button", { name: /account menu/i }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await animationsDone(menu)
  await expect(menu).toBeInViewport({ ratio: 1 })
  const rows = menu.locator('[role="menuitem"], [role="menuitemradio"]')
  await expect(rows).toHaveCount(4)
  for (const row of await rows.all()) {
    expect(Math.round((await row.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(MIN_TAP)
  }
  await snap(page, testInfo, "user-menu-open")
})
