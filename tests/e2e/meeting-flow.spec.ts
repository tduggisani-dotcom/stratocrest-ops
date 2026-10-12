import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import { admin, cleanUpE2eRows, createMeeting, createOrg, e2eLabel } from "./support/admin"
import { collectConsoleErrors, scrollsHorizontally, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * Screen 2 of logging a meeting (spec §6.2: "then prompts a debrief and a follow-up task (one
 * click)"): write the debrief and mark it done, then add the follow-up task in one click, with
 * Undo, and never twice. The investor and its meeting (which happened 2 hours ago, so the
 * database has opened its debrief) are written with the secret key and removed afterwards.
 */
test.afterEach(cleanUpE2eRows)

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

async function followUpTasks(meetingId: string) {
  const { data, error } = await admin
    .from("tasks")
    .select("id, title, organization_id, org_meeting_id, owner_id, archived_at")
    .eq("org_meeting_id", meetingId)
    .order("created_at")
  if (error) throw new Error(`Reading follow-up tasks failed: ${error.message}`)
  return data
}

async function debriefOf(meetingId: string) {
  const { data, error } = await admin
    .from("debriefs")
    .select("status, planned, actual, worked, change, completed_at")
    .eq("org_meeting_id", meetingId)
    .single()
  if (error) throw new Error(`Reading the debrief failed: ${error.message}`)
  return data
}

test("after logging: debrief marked done, and one follow-up task in one click with Undo", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const name = e2eLabel("Scioto Ventures")
  const org = await createOrg({
    kind: "investor",
    name,
    owner_id: me.id,
    next_step: "Send them the pilot results",
    next_step_date: addDays(today, 4),
    stage: "meeting",
  })
  const meeting = await createMeeting(
    {
      organization_id: org.id,
      starts_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      rating: 4,
      summary: "Good first call",
    },
    [me.id],
  )
  const meetingPath = `/investors/${org.id}/meetings/${meeting.id}`

  // A second tab, opened before the follow-up exists and deaf to live updates, still shows
  // the button: the server must not add a second task from it.
  const stale = await context.newPage()
  await stale.routeWebSocket(/\/realtime\//, () => {})
  await stale.goto(meetingPath)
  await waitForContent(stale)
  await expect(stale.getByRole("button", { name: "Add follow-up task" })).toBeVisible()

  await page.goto(`${meetingPath}?logged=1`)
  await waitForContent(page)
  await expect(page.getByRole("heading", { name: "Meeting logged" })).toBeVisible()
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)

  // 1. The debrief: the four questions, then "Save and mark done".
  await page.getByLabel("What was planned?").fill("Show the drop-test video and ask about terms")
  await page.getByLabel("What happened?").fill("They watched it twice and asked for the raw data")
  await page.getByLabel("What worked?").fill("Leading with the video")
  await page.getByLabel("What will we change?").fill("Bring the raw data next time")
  await expect(page.getByLabel("Facilitator")).toHaveValue(me.id)
  await page.getByRole("button", { name: "Save and mark done" }).click()
  await expect(toast(page, "Debrief marked done")).toBeVisible()
  await expect.poll(async () => (await debriefOf(meeting.id)).status).toBe("done")
  const debrief = await debriefOf(meeting.id)
  expect(debrief.worked).toBe("Leading with the video")
  expect(debrief.completed_at).not.toBeNull()
  // The answers show, and the form folds away under "Edit or reopen".
  const logged = page.getByRole("region", { name: "Meeting logged" })
  await expect(
    logged.getByRole("definition").filter({ hasText: "Bring the raw data next time" }),
  ).toBeVisible()
  await expect(logged.getByLabel("What was planned?")).toBeHidden()

  // 2. The follow-up task: one click, linked to the investor and the meeting.
  await page.getByRole("button", { name: "Add follow-up task" }).click()
  const added = toast(page, "Follow-up task added")
  await expect(added).toBeVisible()
  await expect(page.getByRole("link", { name: "Open task" })).toBeFocused()
  await expect.poll(async () => (await followUpTasks(meeting.id)).length).toBe(1)
  const [task] = await followUpTasks(meeting.id)
  expect(task).toMatchObject({
    title: `Follow up with ${name}`,
    organization_id: org.id,
    org_meeting_id: meeting.id,
    owner_id: me.id,
    archived_at: null,
  })
  await expect(page.getByRole("link", { name: "Open task" })).toHaveAttribute(
    "href",
    `/tasks/${task.id}`,
  )

  // Undo archives it (nothing is deleted), and the button comes back.
  await added.getByRole("button", { name: "Undo" }).click()
  await expect(toast(page, "Follow-up task removed")).toBeVisible()
  await expect
    .poll(async () => (await followUpTasks(meeting.id))[0]?.archived_at ?? null)
    .not.toBeNull()
  const again = page.getByRole("button", { name: "Add follow-up task" })
  await expect(again).toBeVisible()

  // 3. Add it again, then click in the stale tab: still one open follow-up task.
  await again.click()
  await expect(toast(page, "Follow-up task added")).toBeVisible()
  await expect
    .poll(async () => (await followUpTasks(meeting.id)).filter((t) => !t.archived_at).length)
    .toBe(1)
  await stale.getByRole("button", { name: "Add follow-up task" }).click()
  await expect(toast(stale, "This meeting already has a follow-up task")).toBeVisible()
  await expect(stale.getByRole("link", { name: "Open task" })).toBeVisible()
  const open = (await followUpTasks(meeting.id)).filter((t) => !t.archived_at)
  expect(open).toHaveLength(1)
  await expect(stale.getByRole("link", { name: "Open task" })).toHaveAttribute(
    "href",
    `/tasks/${open[0].id}`,
  )
  await stale.close()

  // 4. The investor's page: the debrief is Done, the follow-up task is listed.
  await page.getByRole("link", { name: `Back to ${name}` }).click()
  await expect(page).toHaveURL(`/investors/${org.id}`)
  await waitForContent(page)
  const debriefs = page.getByRole("region", { name: "Debriefs" })
  await expect(debriefs.getByRole("listitem")).toHaveCount(1)
  await expect(debriefs.getByRole("listitem")).toContainText("Done")
  await expect(debriefs.getByText(/^Done/)).toHaveClass(/\btext-good\b/)
  const tasks = page.getByRole("region", { name: "Tasks" })
  await expect(tasks.getByRole("link", { name: new RegExp(`Follow up with`) })).toHaveCount(1)
  expect(errors).toEqual([])
})
