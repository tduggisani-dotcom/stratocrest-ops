import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import {
  cleanUpE2eRows,
  createBusyTime,
  createCrunchPeriod,
  createOrgMeeting,
  createTask,
  e2eLabel,
} from "./support/admin"
import {
  collectConsoleErrors,
  offScreenTapTargets,
  scrollsHorizontally,
  smallTapTargets,
  snap,
  waitForContent,
} from "./support/page"
import { teammateFor } from "./support/team"

/**
 * The Stage 2 pages at 390 px (CLAUDE.md: no sideways scroll, tap targets ≥ 44 px), with real
 * rows in them: an open task in a crunch period, a finished task, a busy time and an investor
 * meeting, all for the signed-in teammate (Ian) and all removed afterwards.
 */
test.skip(({ isMobile }) => !isMobile, "Phone layout")
test.afterEach(cleanUpE2eRows)

/** Open every closed <details> in main, so the controls inside are measured too. */
async function openDisclosures(page: Page) {
  const closed = page.locator("main details:not([open]) > summary")
  for (let n = await closed.count(); n > 0; n--) await closed.first().click()
}

async function expectFitsPhone(page: Page, path: string) {
  await page.goto(path)
  await waitForContent(page)
  await openDisclosures(page)
  expect(await scrollsHorizontally(page), `${path} scrolls sideways`).toBe(false)
  expect(await smallTapTargets(page.locator("main")), `${path} has small tap targets`).toEqual([])
  expect(await offScreenTapTargets(page.locator("main")), `${path} hides controls`).toEqual([])
}

test("tasks, people and This Week fit a 390 px phone with 44 px tap targets", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const open = await createTask({
    title: e2eLabel("Order the impact sensors for the second prototype run"),
    owner_id: me.id,
    due_date: addDays(today, 1),
    priority: "high",
    next_action: "Email the supplier the part numbers and ask for a delivery date before Friday",
  })
  await createTask({
    title: e2eLabel("Book the test lab"),
    owner_id: me.id,
    due_date: addDays(today, -2),
    status: "done",
  })
  await createCrunchPeriod({
    person_id: me.id,
    label: e2eLabel("Midterms"),
    start_date: today,
    end_date: addDays(today, 3),
  })
  await createBusyTime({
    person_id: me.id,
    weekday: 2,
    start_time: "09:30",
    end_time: "10:45",
    label: "class",
  })
  await createOrgMeeting({
    name: e2eLabel("Granite Ventures"),
    ownerId: me.id,
    nextStepDate: addDays(today, 30),
    startsAt: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
  })

  for (const path of [
    "/tasks",
    "/tasks?view=owner",
    "/tasks?view=status",
    "/tasks?view=week",
    "/tasks/new",
    `/tasks/${open.id}`,
    "/people",
    `/people/${me.id}`,
    "/",
  ]) {
    await expectFitsPhone(page, path)
  }

  // The archive confirmation's buttons too.
  await page.goto(`/tasks/${open.id}`)
  await waitForContent(page)
  await page.getByRole("button", { name: "Archive task" }).click()
  await expect(page.getByRole("button", { name: "Yes, archive" })).toBeVisible()
  expect(await smallTapTargets(page.locator("main"))).toEqual([])
  expect(await scrollsHorizontally(page)).toBe(false)
  await page.getByRole("button", { name: "Cancel" }).click()

  await page.goto("/tasks")
  await waitForContent(page)
  await snap(page, testInfo, "tasks-mine-with-crunch", { fullPage: true })
  expect(errors).toEqual([])
})
