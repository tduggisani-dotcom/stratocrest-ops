import { expect, test, type Page } from "@playwright/test"
import { addDays, formatDate, sundayOnOrAfter, todayEt } from "@/lib/dates"
import { TASK_MESSAGES } from "@/lib/schemas/tasks"
import { admin, cleanUpE2eRows, e2eLabel } from "./support/admin"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"
import { getTeam, teammateFor } from "./support/team"

/**
 * Tasks (spec §6.4), signed in as the project's saved-session teammate (desktop: John,
 * phone: Ian). Each test makes its own "[e2e]" task and the cleanup deletes it, because
 * teammates can only archive tasks.
 */
test.afterEach(cleanUpE2eRows)

/** The sonner toast that says `text`. */
const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

/** Mark the page so a later check can tell that it was never reloaded. */
async function markPage(page: Page) {
  await page.evaluate(() => {
    ;(window as Window & { __e2eSamePage?: boolean }).__e2eSamePage = true
  })
}
async function stillSamePage(page: Page) {
  return page.evaluate(() => (window as Window & { __e2eSamePage?: boolean }).__e2eSamePage)
}

/** What has keyboard focus: "task link", "body", or the element's id. */
function focusTarget(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement
    if (!active || active === document.body) return "body"
    if (active.hasAttribute("data-task-title")) return "task link"
    return active.id || active.tagName.toLowerCase()
  })
}

/** "Due by today" on a Sunday, else "Due by Sun, Oct 18" (as the Due this week view says). */
function weekListName(today: string) {
  const weekEnd = sundayOnOrAfter(today)
  return `Due by ${weekEnd === today ? "today" : formatDate(weekEnd, "medium")}`
}

async function taskStatus(title: string) {
  const { data, error } = await admin
    .from("tasks")
    .select("id, status, owner_id, due_date, archived_at, completed_at")
    .eq("title", title)
    .single()
  if (error) throw new Error(`Reading task "${title}" failed: ${error.message}`)
  return data
}

test("a new task: inline errors first, then it lands in My tasks and moves with its status", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const title = e2eLabel("Send Jane the deck")

  await page.goto("/tasks/new")
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add a task")
  const owner = page.getByLabel(/^Owner/)
  const due = page.getByLabel(/^Due date/)
  // Owner defaults to me, the due date to a week from today.
  await expect(owner).toHaveValue(me.id)
  await expect(due).toHaveValue(addDays(today, 7))

  // 1. Nothing filled in: inline errors, focus on the first problem, owner is fine.
  await page.getByRole("button", { name: "Add task" }).click()
  const titleInput = page.getByLabel(/^Title/)
  const nextAction = page.getByLabel(/^Next action/)
  await expect(page.getByText(TASK_MESSAGES.title)).toBeVisible()
  await expect(page.getByText(TASK_MESSAGES.nextAction)).toBeVisible()
  await expect(titleInput).toHaveAttribute("aria-invalid", "true")
  await expect(nextAction).toHaveAttribute("aria-invalid", "true")
  await expect(titleInput).toHaveAccessibleDescription(TASK_MESSAGES.title)
  await expect(titleInput).toBeFocused()
  await expect(owner).not.toHaveAttribute("aria-invalid", "true")
  await expect(owner).toHaveValue(me.id)
  await expect(page.getByText("Check the highlighted fields.")).toBeVisible()

  // 2. Fill it in (due today, so it's in "Due this week" too) and save.
  await titleInput.fill(title)
  await nextAction.fill("Email Jane the deck")
  await due.fill(today)
  await page.getByRole("radio", { name: "High" }).check()
  await page.getByRole("button", { name: "Add task" }).click()
  await expect(toast(page, "Task added")).toBeVisible()
  await expect(page).toHaveURL("/tasks")
  await waitForContent(page)

  const openList = page.getByRole("list", { name: "Your open tasks" })
  const row = openList.getByRole("listitem").filter({ hasText: title })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Email Jane the deck")
  await expect(row).toContainText("High priority")
  await expect(row).toContainText("today")
  await snap(page, testInfo, "tasks-mine", { fullPage: true })

  // 3. Inline status: In Progress, then Done, without leaving (or reloading) the page.
  await markPage(page)
  const toDoStatus = row.getByRole("button", { name: `Status for ${title}: To Do` })
  if (testInfo.project.use.hasTouch) {
    // A swipe that starts on the button scrolls the page: touching it opens nothing...
    await toDoStatus.dispatchEvent("pointerdown", {
      pointerType: "touch",
      button: 0,
      isPrimary: true,
    })
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
    await expect(page.getByRole("menu")).toHaveCount(0)
    await expect(toDoStatus).toHaveAttribute("aria-expanded", "false")
    // ...only a finished tap does.
    await toDoStatus.tap()
    await expect(page.getByRole("menu")).toBeVisible()
  } else {
    await toDoStatus.click()
  }
  await page.getByRole("menuitemradio", { name: "In Progress" }).click()
  await expect(toast(page, "Marked In Progress")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).status).toBe("in_progress")
  // Still in "Your open tasks", so focus stays on its status button.
  const statusButton = row.getByRole("button", { name: `Status for ${title}: In Progress` })
  await expect(statusButton).toBeVisible()
  await expect(statusButton).toBeFocused()

  // The other views put it in the right place.
  const views = page.getByRole("navigation", { name: "Task views" })
  await views.getByRole("link", { name: "By owner" }).click()
  await expect(page).toHaveURL("/tasks?view=owner")
  await expect(
    page
      .getByRole("list", { name: `${me.name}'s open tasks` })
      .getByRole("link", { name: title, exact: true }),
  ).toBeVisible()
  await snap(page, testInfo, "tasks-owner", { fullPage: true })
  await views.getByRole("link", { name: "By status" }).click()
  await expect(page).toHaveURL("/tasks?view=status")
  await expect(
    page.getByRole("list", { name: "In Progress" }).getByRole("link", { name: title, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole("list", { name: "To Do" }).getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0)
  await views.getByRole("link", { name: "Due this week" }).click()
  await expect(page).toHaveURL("/tasks?view=week")
  await expect(
    page
      .getByRole("list", { name: weekListName(today) })
      .getByRole("link", { name: title, exact: true }),
  ).toBeVisible()
  await views.getByRole("link", { name: "My tasks" }).click()
  await expect(page).toHaveURL("/tasks")
  await expect(row).toBeVisible()

  // Done from the keyboard.
  await row.getByRole("button", { name: `Done: ${title}` }).focus()
  await page.keyboard.press("Space")
  await expect(toast(page, "Marked Done")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).completed_at).not.toBeNull()
  // Done moves it out of the open list into the collapsed "Done in the last 7 days"; focus
  // moves to the next open task (or the list's heading), not back to the top of the page.
  await expect(openList.getByRole("link", { name: title, exact: true })).toHaveCount(0)
  await expect.poll(() => focusTarget(page)).toMatch(/^(task link|tasks-mine-open)$/)
  const doneList = page.getByRole("list", { name: "Done in the last 7 days" })
  const doneRow = doneList.getByRole("listitem").filter({ hasText: title })
  await page.getByText("Done in the last 7 days").click()
  await expect(doneRow).toBeVisible()
  await expect(doneRow.getByRole("button", { name: `Done: ${title}` })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  const { completed_at: completedAt } = await taskStatus(title)

  // Reopened by mistake: Undo reverses it and keeps the original completion time.
  await doneRow.getByRole("button", { name: `Done: ${title}` }).click()
  const reopened = toast(page, "Marked To Do")
  await expect(reopened).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).completed_at).toBeNull()
  await reopened.getByRole("button", { name: "Undo" }).click()
  await expect(toast(page, "Back to Done")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).status).toBe("done")
  expect((await taskStatus(title)).completed_at).toBe(completedAt)
  // The list may have closed while it was empty.
  if (!(await doneList.isVisible())) await page.getByText("Done in the last 7 days").click()
  await expect(doneRow).toBeVisible()
  await expect(page).toHaveURL("/tasks")
  expect(await stillSamePage(page), "the page reloaded").toBe(true)

  // By status: in "Done in the last 14 days" now.
  await views.getByRole("link", { name: "By status" }).click()
  await expect(page).toHaveURL("/tasks?view=status")
  const doneSection = page.getByRole("list", { name: "Done in the last 14 days" })
  await expect(doneSection.getByRole("link", { name: title, exact: true })).toBeVisible()

  // The status menu: arrowing through it saves nothing; Escape leaves it as it was.
  const doneStatus = doneSection.getByRole("button", { name: `Status for ${title}: Done` })
  await doneStatus.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menu")).toBeVisible()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expect(doneStatus).toBeFocused()
  expect((await taskStatus(title)).status).toBe("done")

  // Picking a status moves the row to that section, and focus goes with it.
  await doneStatus.click()
  await page.getByRole("menuitemradio", { name: "Blocked" }).click()
  await expect(toast(page, "Marked Blocked")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).status).toBe("blocked")
  await expect(
    page
      .getByRole("list", { name: "Blocked" })
      .getByRole("button", { name: `Status for ${title}: Blocked` }),
  ).toBeFocused()

  expect(errors).toEqual([])
})

test("a task page: edit owner and due date, then archive with Undo", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  // Hand it to someone who isn't signed in on either project (Brad).
  const newOwner = (await getTeam())[2]
  const today = todayEt()
  const newDue = addDays(today, 3)
  const title = e2eLabel("Book the lab for drop tests")

  // Start from the list, as people do.
  await page.goto("/tasks/new")
  await waitForContent(page)
  await page.getByLabel(/^Title/).fill(title)
  await page.getByLabel(/^Next action/).fill("Call the lab manager")
  await page.getByRole("button", { name: "Add task" }).click()
  await expect(page).toHaveURL("/tasks")
  await page
    .getByRole("list", { name: "Your open tasks" })
    .getByRole("link", { name: title })
    .click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/)
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
  await expect(page.getByText(`Created by ${me.name}`)).toBeVisible()

  // Edit: new owner and due date.
  const form = page.getByRole("region", { name: "Edit task" })
  await form.getByLabel(/^Owner/).selectOption({ label: newOwner.name })
  await form.getByLabel(/^Due date/).fill(newDue)
  await form.getByRole("button", { name: "Save changes" }).click()
  await expect(toast(page, "Changes saved")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).owner_id).toBe(newOwner.id)
  expect((await taskStatus(title)).due_date).toBe(newDue)

  // The header shows the new owner and date; the form keeps them.
  const header = page.locator("article header")
  await expect(header.getByText(newOwner.name)).toBeVisible()
  await expect(header.getByText(formatDate(newDue, "short"))).toBeVisible()
  await expect(header).toContainText("in 3 days")
  await expect(form.getByLabel(/^Owner/)).toHaveValue(newOwner.id)
  await expect(form.getByLabel(/^Due date/)).toHaveValue(newDue)
  await expect(page.getByText(`Last changed by ${me.name}`)).toBeVisible()
  await snap(page, testInfo, "task-page", { fullPage: true })

  // Archive (two steps), back to /tasks, then Undo from the toast restores it.
  await page.getByRole("button", { name: "Archive task" }).click()
  await page.getByRole("button", { name: "Yes, archive" }).click()
  const archived = toast(page, "Task archived")
  await expect(archived).toBeVisible()
  await expect(page).toHaveURL("/tasks")
  await expect.poll(async () => (await taskStatus(title)).archived_at).not.toBeNull()
  await archived.getByRole("button", { name: "Undo" }).click()
  await expect(toast(page, "Task restored")).toBeVisible()
  await expect.poll(async () => (await taskStatus(title)).archived_at).toBeNull()

  // Restored: back in the owner's list, editable again.
  await page.goto("/tasks?view=owner")
  await waitForContent(page)
  await expect(
    page
      .getByRole("list", { name: `${newOwner.name}'s open tasks` })
      .getByRole("link", { name: title, exact: true }),
  ).toBeVisible()

  expect(errors).toEqual([])
})
