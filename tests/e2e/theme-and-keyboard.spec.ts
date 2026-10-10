import { expect, test } from "@playwright/test"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"

/** Signed in (global setup). */

type ThemeProbe = Window & { __darkWhenBodyStarted?: boolean }

test("dark mode applies at once and persists across reloads with no flash", async ({
  page,
}, testInfo) => {
  // Before any page script runs: note whether <html> is dark when <body> starts to parse,
  // which is before the first paint.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) return
      ;(window as ThemeProbe).__darkWhenBodyStarted =
        document.documentElement.classList.contains("dark")
      observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  })
  const errors = collectConsoleErrors(page)
  const html = page.locator("html")

  await page.goto("/")
  await waitForContent(page)
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/)
  await snap(page, testInfo, "this-week-light")

  await page.getByRole("button", { name: /account menu/i }).click()
  await expect(page.getByRole("menuitemradio", { name: "System" })).toHaveAttribute(
    "aria-checked",
    "true",
  )
  if (testInfo.project.name === "desktop") await snap(page, testInfo, "user-menu-open")
  await page.getByRole("menuitemradio", { name: "Dark" }).click()
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/)
  await expect(page.getByRole("menu")).toBeHidden()
  await snap(page, testInfo, "this-week-dark")

  await page.reload()
  expect(await page.evaluate(() => (window as ThemeProbe).__darkWhenBodyStarted)).toBe(true)
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/)
  await expect(html).toHaveCSS("color-scheme", "dark")
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark")

  // The menu shows the saved choice; switching back to Light also sticks.
  await page.getByRole("button", { name: /account menu/i }).click()
  await expect(page.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true",
  )
  await page.getByRole("menuitemradio", { name: "Light" }).click()
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/)
  await page.reload()
  expect(await page.evaluate(() => (window as ThemeProbe).__darkWhenBodyStarted)).toBe(false)
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/)

  expect(errors).toEqual([])
})

test("System follows the device's dark setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await waitForContent(page)
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/)
  await page.emulateMedia({ colorScheme: "light" })
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/)
})

for (const path of ["/", "/tasks"] as const) {
  test(`keyboard: the first Tab on ${path} reaches "Skip to content", which jumps to the page`, async ({
    page,
  }) => {
    await page.goto(path)
    await waitForContent(page)

    await page.keyboard.press("Tab")
    const skipLink = page.getByRole("link", { name: "Skip to content" })
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeInViewport()

    await page.keyboard.press("Enter")
    const main = page.locator("main#main")
    await expect(main).toBeFocused()

    // The next Tab goes to the page itself, not back through the navigation.
    await page.keyboard.press("Tab")
    const insideMain = await page.evaluate(
      () => document.querySelector("main")?.contains(document.activeElement) ?? false,
    )
    // This Week has nothing focusable yet in Stage 1; section pages have their first-item button.
    if (path !== "/") expect(insideMain).toBe(true)
  })
}
