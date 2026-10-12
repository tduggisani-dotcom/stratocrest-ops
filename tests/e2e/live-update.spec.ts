import { expect, test, type Page } from "@playwright/test"
import { todayEt } from "@/lib/dates"
import { signedOut, signInWithCode } from "./support/auth"
import { cleanUpE2eRows, e2eLabel } from "./support/admin"
import { collectConsoleErrors, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * Live updates (spec §7): two browsers. A is the saved session (John); B is a second teammate
 * signed in by the real email-code flow. When A adds a task for B, B's This Week shows it
 * without a reload, through Supabase Realtime.
 */
test.afterEach(cleanUpE2eRows)

/**
 * Resolves once the page's Realtime channel is listening to Postgres changes: Supabase sends
 * a "Subscribed to PostgreSQL" system message on the websocket when it is.
 */
function liveSubscription(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        if (String(payload).includes("Subscribed to PostgreSQL")) resolve()
      })
    })
  })
}

test("a task added for a teammate appears on their This Week without a reload", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Two browsers once per run is enough")
  const errors = collectConsoleErrors(page)
  const teammate = await teammateFor(testInfo.project.name, "live")
  const today = todayEt()
  const title = e2eLabel("Check the drop-test results")

  const other = await browser.newContext({
    ...testInfo.project.use,
    storageState: signedOut,
  })
  try {
    // B: signs in and lands on This Week, listening for changes.
    const theirPage = await other.newPage()
    const theirErrors = collectConsoleErrors(theirPage)
    const subscribed = liveSubscription(theirPage)
    await signInWithCode(theirPage, teammate.email)
    await expect(theirPage.getByRole("heading", { level: 1 })).toHaveText(
      `Hi, ${teammate.firstName}`,
    )
    await waitForContent(theirPage)
    await Promise.race([
      subscribed,
      theirPage.waitForTimeout(15_000).then(() => {
        throw new Error("This Week never subscribed to Realtime changes")
      }),
    ])
    const myWork = theirPage.getByRole("region", { name: "My work", exact: true })
    await expect(myWork.getByRole("link", { name: title })).toHaveCount(0)
    await theirPage.evaluate(() => {
      ;(window as Window & { __e2eSamePage?: boolean }).__e2eSamePage = true
    })

    // A: adds a task for B, due today.
    await page.goto("/tasks/new")
    await waitForContent(page)
    await page.getByLabel(/^Title/).fill(title)
    await page.getByLabel(/^Next action/).fill("Read the lab report")
    await page.getByLabel(/^Owner/).selectOption({ label: teammate.name })
    await page.getByLabel(/^Due date/).fill(today)
    await page.getByRole("button", { name: "Add task" }).click()
    await expect(page).toHaveURL("/tasks")

    // B: it shows up in My work by itself, on the same page (no reload).
    await expect(myWork.getByRole("link", { name: title })).toBeVisible({
      timeout: 10_000,
    })
    await expect(myWork.getByRole("link", { name: title })).toContainText("today")
    expect(
      await theirPage.evaluate(
        () => (window as Window & { __e2eSamePage?: boolean }).__e2eSamePage,
      ),
      "B's page reloaded",
    ).toBe(true)
    expect(theirErrors).toEqual([])
  } finally {
    await other.close()
  }
  expect(errors).toEqual([])
})
