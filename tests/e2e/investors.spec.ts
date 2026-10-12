import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import { ORG_MESSAGES, orgKindMessages } from "@/lib/schemas/organizations"
import { cleanUpE2eRows, createOrg, e2eLabel, orgIdByName } from "./support/admin"
import { filterBy, openList, orgItem, orgItems, parseCsv } from "./support/orgs"
import { collectConsoleErrors, scrollsHorizontally, snap, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * The Investor Tracker's "done when" (spec §6.2), on desktop and at 390 px: add an investor,
 * log two meetings with ratings, see the latest one in the table, filter by region, export
 * CSV. Signed in as the project's saved-session teammate (desktop: John, phone: Ian); every
 * row is "[e2e]" and removed afterwards.
 */
test.afterEach(cleanUpE2eRows)

const UUID = "[0-9a-f-]{36}"

/** The sonner toast that says `text`. */
const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

async function fitsScreen(page: Page, mobile: boolean, where: string) {
  if (mobile) expect(await scrollsHorizontally(page), `${where} scrolls sideways`).toBe(false)
}

/**
 * Log a meeting from the org page in two screens: the form, then the meeting's page with
 * "Meeting logged". Returns the meeting page's path.
 */
async function logMeeting(
  page: Page,
  mobile: boolean,
  meeting: { date: string; time: string; rating: number; summary: string },
): Promise<string> {
  const screens: string[] = []
  const track = (frame: { url(): string }) => {
    if (frame === page.mainFrame()) screens.push(new URL(frame.url()).pathname)
  }
  page.on("framenavigated", track)

  await page.getByRole("main").getByRole("link", { name: "Log meeting" }).first().click()
  // Screen 1: the form.
  await expect(page.getByRole("heading", { level: 1, name: "Log a meeting" })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/investors/${UUID}/meetings/new$`))
  await fitsScreen(page, mobile, "the meeting form")
  // The person logging it is on the attendee list already.
  await expect(
    page.getByRole("group", { name: /^Who went from our side/ }).getByRole("checkbox", {
      checked: true,
    }),
  ).toHaveCount(1)
  await page.getByLabel(/^Date/).fill(meeting.date)
  await page.getByLabel(/^Time \(ET\)/).fill(meeting.time)
  await page.getByRole("radio", { name: `${meeting.rating} out of 5` }).check()
  await page.getByLabel("One-line summary").fill(meeting.summary)
  await page.getByRole("button", { name: "Log meeting" }).click()

  // Screen 2: the meeting's page, with the debrief and the follow-up task to hand.
  const logged = page.getByRole("heading", { name: "Meeting logged" })
  await expect(logged).toBeVisible()
  await expect(logged).toBeFocused()
  await expect(page).toHaveURL(new RegExp(`/investors/${UUID}/meetings/${UUID}\\?logged=1$`))
  await expect(page.getByRole("button", { name: "Save and mark done" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Add follow-up task" })).toBeVisible()
  await waitForContent(page)
  await fitsScreen(page, mobile, "the logged meeting")

  page.off("framenavigated", track)
  const distinct = screens.filter((path, i) => path !== screens[i - 1])
  expect(distinct, "logging a meeting takes two screens").toHaveLength(2)
  expect(distinct[0]).toMatch(/\/meetings\/new$/)
  return new URL(page.url()).pathname
}

test("add an investor, log two rated meetings, see the latest, filter by region, export CSV", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000)
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const name = e2eLabel("Buckeye Angels")
  const messages = orgKindMessages("investor")
  // Another investor, outside Ohio, so the region filter has something to leave out.
  const elsewhere = e2eLabel("Lakeshore Seed")
  await createOrg({
    kind: "investor",
    name: elsewhere,
    owner_id: me.id,
    next_step_date: addDays(today, 5),
    region: "midwest",
    city: "Chicago",
  })

  // 1. Add it: an empty submit shows inline errors on the required fields first.
  await page.goto("/investors/new")
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add investor")
  const nameInput = page.getByLabel(/^Name/)
  const nextStep = page.getByRole("textbox", { name: /^Next step \(required\)/ })
  await expect(page.getByLabel(/^Coatl point of contact/)).toHaveValue(me.id)
  await page.getByRole("button", { name: "Add investor" }).click()
  await expect(page.getByText(messages.name)).toBeVisible()
  await expect(page.getByText(ORG_MESSAGES.nextStep)).toBeVisible()
  await expect(nameInput).toHaveAttribute("aria-invalid", "true")
  await expect(nameInput).toHaveAccessibleDescription(messages.name)
  await expect(nextStep).toHaveAttribute("aria-invalid", "true")
  await expect(nameInput).toBeFocused()
  await fitsScreen(page, mobile, "the investor form with errors")

  await nameInput.fill(name)
  await nextStep.fill("Send the deck to their partner")
  await page.getByLabel(/^Next step date/).fill(addDays(today, 10))
  await page.locator("summary").filter({ hasText: "Where" }).click()
  await page.getByLabel("City").fill("Columbus")
  await page.getByLabel("State or country").fill("OH")
  await page.getByLabel("Region").selectOption({ label: "Ohio" })
  await page.getByRole("button", { name: "Add investor" }).click()
  await expect(toast(page, "Investor added")).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/investors/${UUID}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
  await waitForContent(page)
  const orgPath = new URL(page.url()).pathname
  expect(orgPath).toBe(`/investors/${await orgIdByName("investor", name)}`)
  await expect(page.getByRole("main")).toContainText(me.name)
  await fitsScreen(page, mobile, "the investor page")

  // 2. Two meetings, the second one later: rated 3, then 5.
  const first = { date: addDays(today, -10), time: "10:00", rating: 3, summary: "Liked the demo" }
  const second = {
    date: addDays(today, -3),
    time: "14:30",
    rating: 5,
    summary: "Asked for the data room",
  }
  await logMeeting(page, mobile, { ...first, summary: `${first.summary}, wants test data` })

  // The table shows the first one, neutral (only 4–5 is green).
  await openList(page, "investor")
  let row = orgItem(page, "investor", mobile, name)
  await expect(row).toContainText("Rated 3 out of 5")
  await expect(row.getByText("Rated 3 out of 5").locator("..")).not.toHaveClass(/\btext-good\b/)

  await page.goto(orgPath)
  await waitForContent(page)
  await logMeeting(page, mobile, second)
  await snap(page, testInfo, "meeting-logged", { fullPage: true })

  // Both are in the org's meeting log, the latest first.
  await page.getByRole("link", { name: `Back to ${name}` }).click()
  await expect(page).toHaveURL(orgPath)
  await waitForContent(page)
  const log = page.getByRole("region", { name: "Meetings" }).getByRole("list", { name: "Meetings" })
  await expect(log.getByRole("listitem")).toHaveCount(2)
  await expect(log.getByRole("listitem").nth(0)).toContainText(second.summary)
  await expect(log.getByRole("listitem").nth(1)).toContainText(first.summary)
  await snap(page, testInfo, "investor-page", { fullPage: true })

  // 3. The list shows the latest meeting: 5/5 in green, with its summary.
  await openList(page, "investor")
  row = orgItem(page, "investor", mobile, name)
  await expect(row).toContainText("Rated 5 out of 5")
  await expect(row.getByText("Rated 5 out of 5").locator("..")).toHaveClass(/\btext-good\b/)
  await expect(row).toContainText(second.summary)
  await expect(row).not.toContainText(first.summary)
  await expect(row).toContainText("Columbus")
  await expect(row).toContainText(me.name)
  await expect(orgItem(page, "investor", mobile, elsewhere)).toBeVisible()
  await fitsScreen(page, mobile, "the investor list")
  await snap(page, testInfo, "investors-list", { fullPage: true })

  // 4. Filter by region: only Ohio is left.
  await filterBy(page, "investor", mobile, "Region", "Ohio")
  await expect(page).toHaveURL(/[?&]region=ohio(&|$)/)
  await waitForContent(page)
  await expect(orgItem(page, "investor", mobile, name)).toBeVisible()
  await expect(orgItem(page, "investor", mobile, elsewhere)).toHaveCount(0)
  for (const item of await orgItems(page, "investor", mobile).all()) {
    await expect(item).toContainText("Ohio")
  }

  // 5. Export CSV of the filtered view.
  const exportLink = page.getByRole("link", { name: "Export CSV" })
  await expect(exportLink).toHaveAttribute("href", /\/investors\/export\?(.*&)?region=ohio/)
  const [download] = await Promise.all([page.waitForEvent("download"), exportLink.click()])
  expect(download.suggestedFilename()).toBe(`investors-${today}.csv`)
  const csv = readFileSync(await download.path(), "utf8")
  expect(csv.charCodeAt(0), "the file starts with a UTF-8 byte order mark").toBe(0xfeff)
  const [header, ...rows] = parseCsv(csv.slice(1))
  expect(header.slice(0, 4)).toEqual(["Company", "Stage", "Subtype", "Coatl point of contact"])
  const column = (title: string) => header.indexOf(title)
  expect(rows.length).toBeGreaterThan(0)
  for (const cells of rows) expect(cells[column("Region")]).toBe("Ohio")
  const mine = rows.find((cells) => cells[column("Company")] === name)
  expect(mine, "the new investor is in the export").toBeTruthy()
  expect(mine?.[column("Coatl point of contact")]).toBe(me.name)
  expect(mine?.[column("City")]).toBe("Columbus")
  expect(mine?.[column("Latest rating")]).toBe("5")
  expect(mine?.[column("Latest summary")]).toBe(second.summary)
  expect(mine?.[column("Latest meeting")]).toBe(`${second.date} ${second.time}`)
  expect(rows.some((cells) => cells[column("Company")] === elsewhere)).toBe(false)

  // 6. The same name again (any case) is caught inline, with a link to the one we have.
  await page.goto("/investors/new")
  await waitForContent(page)
  await page.getByLabel(/^Name/).fill(name.toUpperCase())
  await page.getByRole("textbox", { name: /^Next step \(required\)/ }).fill("Check for duplicates")
  await page.getByRole("button", { name: "Add investor" }).click()
  // The message names the investor we already have.
  await expect(page.getByText(messages.duplicate(name))).toBeVisible()
  await expect(page.getByLabel(/^Name/)).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByRole("link", { name: `Open ${name}` })).toHaveAttribute("href", orgPath)
  await expect(page).toHaveURL("/investors/new")
  expect(errors).toEqual([])
})
