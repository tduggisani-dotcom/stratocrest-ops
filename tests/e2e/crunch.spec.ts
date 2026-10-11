import { expect, test, type Locator } from "@playwright/test"
import { crunchWarning } from "@/lib/crunch"
import { addDays, formatDate, todayEt } from "@/lib/dates"
import { admin, cleanUpE2eRows, e2eLabel } from "./support/admin"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"
import { getTeam } from "./support/team"

/**
 * Crunch periods warn, never block (spec §6.4, §6.10): a crunch period added on a teammate's
 * profile makes the task form warn when that teammate gets a task due inside it.
 */
test.afterEach(cleanUpE2eRows)

/** A crunch warning box: visible, neutral (not a status colour), with its warning icon. */
async function expectNeutralWarning(box: Locator) {
  await expect(box).toBeVisible()
  await expect(box).toHaveClass(/\bbg-muted\/50\b/)
  await expect(box).toHaveClass(/\btext-foreground\b/)
  await expect(box).not.toHaveClass(/\b(?:bg|text|border)-(?:stale|overdue|good)/)
  await expect(box.locator("svg.lucide-triangle-alert")).toBeAttached()
}

test("a task due in a teammate's crunch period gets a warning but still saves", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  // Brad: not signed in on either project, so it's always "a teammate".
  const teammate = (await getTeam())[2]
  const today = todayEt()
  const period = {
    personId: teammate.id,
    label: e2eLabel("Finals"),
    startDate: addDays(today, 2),
    endDate: addDays(today, 6),
  }
  const title = e2eLabel("Review the cost model")

  // 1. Add the crunch period from the People page.
  await page.goto("/people")
  await waitForContent(page)
  await page.getByRole("link", { name: teammate.name, exact: true }).click()
  await expect(page).toHaveURL(`/people/${teammate.id}`)
  await waitForContent(page)
  const add = page.locator("#crunch-add")
  await add.getByLabel("What it is").fill(period.label)
  await add.getByLabel("First day").fill(period.startDate)
  await add.getByLabel("Last day").fill(period.endDate)
  await add.getByRole("button", { name: "Add crunch period" }).click()
  await expect(page.getByText(`Added ${period.label}`)).toBeVisible()
  await expect(
    page.getByRole("list", { name: "Now and coming up" }).getByText(period.label),
  ).toBeVisible()

  // 2. A task for them, due inside it: the form warns as soon as owner and date match.
  await page.goto("/tasks/new")
  await waitForContent(page)
  const warningText = crunchWarning(teammate.name, period, (day) => formatDate(day, "short"))
  const warning = page.getByText(warningText)
  await page.getByLabel(/^Title/).fill(title)
  await page.getByLabel(/^Next action/).fill("Send the model to Sam")
  await page.getByLabel(/^Due date/).fill(addDays(today, 4))
  await expect(warning).toHaveCount(0) // still owned by me
  await page.getByLabel(/^Owner/).selectOption({ label: teammate.name })
  await expect(warning).toBeVisible()
  await expect(warning).toContainText("You can still save it.")
  // Neutral (amber means stale, red overdue: spec §7) with a warning icon, announced
  // politely, and tied to the date field.
  const box = page.locator("p").filter({ hasText: warningText })
  await expectNeutralWarning(box)
  await expect(box.locator("..")).toHaveAttribute("aria-live", "polite")
  const describedBy = await page.getByLabel(/^Due date/).getAttribute("aria-describedby")
  expect(describedBy?.split(" ")).toContain(await box.locator("..").getAttribute("id"))
  await snap(page, testInfo, "task-new-crunch-warning", { fullPage: true })

  // A date outside the period clears the warning; back inside brings it back.
  await page.getByLabel(/^Due date/).fill(addDays(today, 8))
  await expect(warning).toHaveCount(0)
  await page.getByLabel(/^Due date/).fill(addDays(today, 4))
  await expect(warning).toBeVisible()

  // 3. Saving still works; the toast repeats the warning.
  await page.getByRole("button", { name: "Add task" }).click()
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Task added" })).toContainText(
    warningText,
  )
  await expect(page).toHaveURL("/tasks")
  const { data: saved } = await admin
    .from("tasks")
    .select("owner_id, due_date")
    .eq("title", title)
    .single()
  expect(saved).toEqual({ owner_id: teammate.id, due_date: addDays(today, 4) })

  // Their list marks the task as due in a crunch period.
  await page.goto("/tasks?view=owner")
  await waitForContent(page)
  const row = page
    .getByRole("list", { name: `${teammate.name}'s open tasks` })
    .getByRole("listitem")
    .filter({ hasText: title })
  await expect(
    row.getByText(`Due in ${teammate.firstName}'s crunch period: ${period.label}`),
  ).toBeAttached()
  const pill = row.locator('[data-slot="badge"]').filter({ hasText: "Crunch" })
  await expect(pill).toBeVisible()
  await expect(pill).toHaveAttribute("data-variant", "outline")
  await expect(pill).not.toHaveClass(/\b(?:bg|text)-(?:stale|overdue|good)/)
  await expect(pill.locator("svg.lucide-triangle-alert")).toBeAttached()

  // The task's page repeats the warning under its title, and its edit form (same owner and
  // date) warns too, both styled the same way.
  await row.getByRole("link", { name: title, exact: true }).click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/)
  await waitForContent(page)
  // (:visible: the Tasks page stays in the DOM, hidden, after a client-side navigation.)
  const taskPage = page.locator("article:visible")
  await expectNeutralWarning(taskPage.locator("header p").filter({ hasText: warningText }))
  await expectNeutralWarning(
    taskPage
      .getByRole("region", { name: "Edit task" })
      .locator("p")
      .filter({ hasText: warningText }),
  )

  expect(errors).toEqual([])
})
