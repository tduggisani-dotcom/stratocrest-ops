import { expect, test, type Page } from "@playwright/test"
import { MOBILE_MORE, MOBILE_TABS, NAV_ITEMS, type NavItem } from "@/components/shell/nav-config"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/** Signed in (global setup). Every section is reached the way people reach it on each device. */

async function expectSection(page: Page, item: NavItem, firstName: string) {
  await expect(page).toHaveURL(item.href)
  const title = item.href === "/" ? `Hi, ${firstName}` : item.label
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
  await waitForContent(page)
  // One visible h1. (Next keeps recently visited pages mounted but hidden, for instant Back.)
  await expect(page.locator("h1:visible")).toHaveCount(1)
}

test("every section loads from the desktop sidebar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The sidebar is desktop-only")
  const { firstName } = await teammateFor(testInfo.project.name, "session")
  const errors = collectConsoleErrors(page)

  await page.goto("/")
  await expectSection(page, NAV_ITEMS[0], firstName)
  const sidebar = page.getByRole("navigation", { name: "Main" })
  // Visit every section, ending back on This Week.
  for (const item of [...NAV_ITEMS.slice(1), NAV_ITEMS[0]]) {
    const link = sidebar.getByRole("link", { name: item.label, exact: true })
    await link.click()
    await expectSection(page, item, firstName)
    await expect(link).toHaveAttribute("aria-current", "page")
    await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1)
  }
  expect(errors).toEqual([])
})

test("every section loads from the phone bottom nav and the More sheet", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The bottom nav is phone-only")
  const { firstName } = await teammateFor(testInfo.project.name, "session")
  const errors = collectConsoleErrors(page)

  await page.goto("/settings")
  await waitForContent(page)
  const bottomNav = page.getByRole("navigation", { name: "Main" })

  for (const item of MOBILE_TABS) {
    const tab = bottomNav.getByRole("link", { name: item.shortLabel ?? item.label, exact: true })
    await tab.click()
    await expectSection(page, item, firstName)
    await expect(tab).toHaveAttribute("aria-current", "page")
  }

  for (const [index, item] of MOBILE_MORE.entries()) {
    await bottomNav.getByRole("button", { name: "More", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "More" })
    await expect(sheet).toBeVisible()
    if (index === 0) await snap(page, testInfo, "more-sheet-open")
    await sheet
      .getByRole("navigation", { name: "More sections" })
      .getByRole("link", { name: item.label, exact: true })
      .click()
    await expect(sheet).toBeHidden()
    await expectSection(page, item, firstName)
  }

  // The sheet marks the current section and closes with its Close button.
  await bottomNav.getByRole("button", { name: "More", exact: true }).click()
  const sheet = page.getByRole("dialog", { name: "More" })
  const last = MOBILE_MORE[MOBILE_MORE.length - 1]
  await expect(sheet.getByRole("link", { name: last.label, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await sheet.getByRole("button", { name: "Close" }).click()
  await expect(sheet).toBeHidden()

  expect(errors).toEqual([])
})

test("an unknown address shows the not-found page with a way home", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const response = await page.goto("/no-such-page")
  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("We couldn't find that page")
  await snap(page, testInfo, "not-found")

  await page.getByRole("link", { name: "Go to This Week" }).click()
  await expect(page).toHaveURL("/")
  await waitForContent(page)
  // The browser logs the 404 response itself; nothing else may error.
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([])
})

test("a signed-in visit to sign-in goes straight on to where you were headed", async ({ page }) => {
  await page.goto("/sign-in?next=%2Fpeople")
  await expect(page).toHaveURL("/people")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("People")

  // An outside address in `next` is ignored.
  await page.goto("/sign-in?next=%2F%2Fexample.com")
  await expect(page).toHaveURL("/")
})
