import { expect, test, type Page } from "@playwright/test"
import { addDays, daysBetween, formatDate, formatTime, todayEt } from "@/lib/dates"
import { admin, cleanUpE2eRows, createOrgMeeting, createTask, e2eLabel } from "./support/admin"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * This Week (spec §6.1), signed in as the project's saved-session teammate (desktop: John,
 * phone: Ian). Data the page needs is written with the secret key and removed afterwards; the
 * Synthe6 schedule and the Sunday meeting are the seeded ones, read from the database.
 */
test.afterEach(cleanUpE2eRows)

const section = (page: Page, name: string) => page.getByRole("region", { name, exact: true })

/** "Today" / "Tomorrow" / "In 3 days": how the cards count down to a day. */
function countdown(from: string, to: string): string {
  const days = daysBetween(from, to)
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`
}

test("my overdue task shows in My work and, in red, in Needs attention", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const title = e2eLabel("Send the investor update")
  await createTask({
    title,
    owner_id: me.id,
    due_date: addDays(today, -1),
    next_action: "Paste the numbers into the update",
  })

  await page.goto("/")
  await waitForContent(page)

  // My work: the task, its next action and how late it is.
  const mine = section(page, "My work").getByRole("list", { name: "Open tasks" })
  const myRow = mine.getByRole("listitem").filter({ hasText: title })
  await expect(myRow).toContainText("Paste the numbers into the update")
  await expect(myRow.getByText("overdue yesterday").locator("..")).toHaveClass(/\btext-overdue\b/)

  // Needs attention: in "Overdue tasks" (a red count), with its owner.
  const overdue = section(page, "Needs attention").getByRole("list", { name: "Overdue tasks" })
  const row = overdue.getByRole("listitem").filter({ hasText: title })
  await expect(row).toContainText(me.name)
  await expect(row.getByText("overdue yesterday").locator("..")).toHaveClass(/\btext-overdue\b/)
  const count = section(page, "Needs attention")
    .getByRole("heading", { name: "Overdue tasks" })
    .locator("xpath=following-sibling::*[1]")
  await expect(count).toHaveText(/^\d+ overdue$/)
  await expect(count).toHaveClass(/\btext-overdue\b/)

  // The row opens the task.
  await row.getByRole("link").click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title)
  expect(errors).toEqual([])
})

test("the next Synthe6 session counts down, and the Sunday meeting names its facilitator", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page)
  const today = todayEt()
  const { data: session } = await admin
    .from("synthe6_sessions")
    .select("week_label, start_date")
    .eq("is_break", false)
    .gte("end_date", today)
    .order("start_date")
    .limit(1)
    .single()
  expect(session, "the seeded Synthe6 schedule has a session ahead").toBeTruthy()
  if (!session) return

  await page.goto("/")
  await waitForContent(page)
  const sessionCard = section(page, "Next Synthe6 session")
  if (session.week_label) await expect(sessionCard.getByText(session.week_label)).toBeVisible()
  await expect(sessionCard).toContainText(formatDate(session.start_date, "medium"))
  await expect(sessionCard).toContainText(countdown(today, session.start_date))
  await expect(sessionCard.getByRole("link", { name: "Program" })).toHaveAttribute(
    "href",
    "/program",
  )

  // The scheduled checks may move to next week's meeting at any time, so compare the card with
  // what the database says now, reloading if it just changed.
  const meetingCard = section(page, "Next Sunday meeting")
  await expect(async () => {
    const { data: meeting, error } = await admin
      .from("team_meetings")
      .select("meeting_date, starts_at, facilitator:people!team_meetings_facilitator_id_fkey(name)")
      .eq("status", "upcoming")
      .gte("meeting_date", today)
      .order("meeting_date")
      .limit(1)
      .single()
    if (error) throw new Error(`Reading the next Sunday meeting failed: ${error.message}`)
    await page.reload()
    await waitForContent(page)
    const facilitating = meetingCard.getByText("Facilitating").locator("..")
    await expect(facilitating).toContainText(meeting.facilitator.name, { timeout: 2_000 })
    await expect(meetingCard).toContainText(
      `${formatDate(meeting.meeting_date, "medium")} · ${formatTime(meeting.starts_at)}`,
      { timeout: 2_000 },
    )
    await expect(meetingCard).toContainText(countdown(today, meeting.meeting_date))
    await expect(meetingCard).toContainText(/\d of 6 posted/)
  }).toPass({ timeout: 20_000 })
  expect(errors).toEqual([])
})

test("an investor meeting in the next 7 days shows with who's going", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const name = e2eLabel("Ridge Capital")
  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  startsAt.setUTCMinutes(0, 0, 0)
  await createOrgMeeting({
    name,
    ownerId: me.id,
    nextStepDate: addDays(today, 30),
    startsAt: startsAt.toISOString(),
  })
  // A task due yesterday too, so the screenshots show the cards with something in them.
  await createTask({
    title: e2eLabel("Draft the pitch FAQ"),
    owner_id: me.id,
    due_date: addDays(today, -1),
  })

  await page.goto("/")
  await waitForContent(page)
  const meetings = section(page, "Meetings in the next 7 days").getByRole("list", {
    name: "Meetings in the next 7 days",
  })
  const row = meetings.getByRole("listitem").filter({ hasText: name })
  await expect(row).toContainText("Investor")
  await expect(row).toContainText(formatTime(startsAt))
  // Nobody is listed as going, so the card shows the org's owner.
  await expect(row).toContainText("Owner:")
  await expect(row).toContainText(me.name)
  await expect(row.getByRole("link")).toHaveAttribute("href", "/investors")

  await snap(page, testInfo, "this-week-data-light", { fullPage: true })
  await page.emulateMedia({ colorScheme: "dark" })
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/)
  await snap(page, testInfo, "this-week-data-dark", { fullPage: true })
  expect(errors).toEqual([])
})
