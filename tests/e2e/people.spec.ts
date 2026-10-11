import { expect, test, type Page } from "@playwright/test"
import { addDays, formatDate, todayEt } from "@/lib/dates"
import { cleanUpE2eRows, createCrunchPeriod, e2eLabel, keepProfile } from "./support/admin"
import { collectConsoleErrors, snap, waitForContent } from "./support/page"
import { getTeam, teammateFor } from "./support/team"

/**
 * People (spec §6.10, profile parts), signed in as the project's saved-session teammate
 * (desktop: John, phone: Ian). Profile edits are put back afterwards; busy times and crunch
 * periods carry "[e2e]" and are deleted.
 */
test.afterEach(cleanUpE2eRows)

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

test("the People page lists the six teammates and marks me as You", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const team = await getTeam()

  await page.goto("/people")
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("People")
  const cards = page.getByRole("list", { name: "Team" }).locator(":scope > li")
  await expect(cards).toHaveCount(6)
  for (const [index, person] of team.entries()) {
    // In team order, each with a link to their profile.
    const card = cards.nth(index)
    await expect(card.getByRole("link", { name: person.name, exact: true })).toHaveAttribute(
      "href",
      `/people/${person.id}`,
    )
    await expect(card.getByText("You", { exact: true })).toHaveCount(person.id === me.id ? 1 : 0)
  }
  await snap(page, testInfo, "people", { fullPage: true })

  // The whole card opens the profile (its name link covers the card).
  await cards.nth(team.findIndex((p) => p.id === me.id)).click({ position: { x: 24, y: 24 } })
  await expect(page).toHaveURL(`/people/${me.id}`)
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(me.name)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("You")
  for (const heading of [
    "What they own",
    "Strengths & skills",
    "When they're busy",
    "Crunch periods",
    "Edit profile",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible()
  }
  expect(errors).toEqual([])
})

test("editing my profile: duplicate strengths are caught inline, then it saves and shows", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const restore = await keepProfile(me.id)
  try {
    const contact = `${e2eLabel("Contact")}: text first; email for documents.`
    await page.goto(`/people/${me.id}`)
    await waitForContent(page)
    const form = page.getByRole("form", { name: "Edit profile" })
    const pick = (rank: string) => form.getByLabel(rank, { exact: true })

    // 1. The same strength twice: rejected on the picker that repeats it, focus goes there.
    await form.getByLabel("How to reach me").fill(contact)
    await pick("1st").selectOption("Achiever")
    await pick("2nd").selectOption("Achiever")
    await form.getByRole("button", { name: "Save profile" }).click()
    const duplicate =
      "Achiever is already picked. Choose a different strength, or leave this one empty."
    await expect(form.getByText(duplicate)).toBeVisible()
    await expect(pick("2nd")).toHaveAttribute("aria-invalid", "true")
    await expect(pick("2nd")).toHaveAccessibleDescription(duplicate)
    await expect(pick("2nd")).toBeFocused()
    await expect(pick("1st")).not.toHaveAttribute("aria-invalid", "true")
    // What I typed and picked is still there.
    await expect(pick("1st")).toHaveValue("Achiever")
    await expect(form.getByLabel("How to reach me")).toHaveValue(contact)

    // 2. Fix it, add skills (a repeat is dropped), save.
    await pick("2nd").selectOption("Learner")
    await pick("3rd").selectOption("Strategic")
    await form.getByLabel("Skills", { exact: true }).fill("CAD, grant writing, cad")
    await form.getByRole("button", { name: "Save profile" }).click()
    await expect(toast(page, "Profile saved.")).toBeVisible()
    await expect(form.getByText(duplicate)).toHaveCount(0)

    // Shown on the profile: contact line, ranked strengths with domains, skills.
    await expect(page.locator("header").getByText(contact)).toBeVisible()
    const strengths = page.getByRole("list", { name: "CliftonStrengths top 5" })
    await expect(strengths.getByRole("listitem")).toHaveText([
      /Achiever.*Executing/,
      /Learner.*Strategic Thinking/,
      /Strategic.*Strategic Thinking/,
    ])
    await expect(page.getByRole("list", { name: /^Skills/ }).getByRole("listitem")).toHaveText([
      "CAD",
      "grant writing",
    ])
    // The form now starts from the saved values.
    await expect(pick("2nd")).toHaveValue("Learner")
    await expect(pick("4th")).toHaveValue("")
    await expect(form.getByLabel("Skills", { exact: true })).toHaveValue("CAD, grant writing")
    await snap(page, testInfo, "profile", { fullPage: true })

    // ...and on my card on /people.
    await page.goto("/people")
    await waitForContent(page)
    const card = page
      .getByRole("list", { name: "Team" })
      .locator(":scope > li")
      .filter({
        has: page.getByRole("link", { name: me.name, exact: true }),
      })
    await expect(card).toContainText(contact)
    await expect(card).toContainText("Achiever")
    await expect(card).toContainText("Strategic")
  } finally {
    await restore()
  }
  expect(errors).toEqual([])
})

test("a weekly busy time can be added and removed", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  await page.goto(`/people/${me.id}`)
  await waitForContent(page)

  const add = page.locator("#busy-add")
  await add.getByLabel("Day").selectOption({ label: "Wednesday" })
  await add.getByLabel("What it is").selectOption({ label: "Class" })
  await add.getByLabel("From (ET)").fill("14:00")
  await add.getByLabel("To (ET)").fill("15:30")
  await add.getByLabel(/^Note/).fill(e2eLabel("ECON 101"))
  await add.getByRole("button", { name: "Add busy time" }).click()
  await expect(toast(page, "Added Wednesday 2:00 PM – 3:30 PM.")).toBeVisible()

  const week = page.getByRole("list", { name: `${me.firstName}'s week` })
  await expect(week.getByRole("list", { name: "Wednesday" })).toContainText("2:00 PM – 3:30 PM")
  await expect(week.getByRole("list", { name: "Wednesday" })).toContainText("Class")

  await page.getByRole("button", { name: "Remove Wednesday 2:00 PM class block" }).click()
  await expect(toast(page, "Removed the Wednesday 2:00 PM class block.")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove Wednesday 2:00 PM class block" }),
  ).toHaveCount(0)
  // Focus isn't lost with the button: it goes to the section heading.
  await expect(page.getByRole("heading", { name: "When they're busy", exact: true })).toBeFocused()
  await expect(page.getByText("No busy times yet")).toBeVisible()
  expect(errors).toEqual([])
})

test("a crunch period can be added and removed", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const label = e2eLabel("Finals")
  const [start, end] = [addDays(today, 10), addDays(today, 14)]
  await page.goto(`/people/${me.id}`)
  await waitForContent(page)

  // An end before the start is caught inline.
  const add = page.locator("#crunch-add")
  await add.getByLabel("What it is").fill(label)
  await add.getByLabel("First day").fill(end)
  await add.getByLabel("Last day").fill(start)
  await add.getByRole("button", { name: "Add crunch period" }).click()
  await expect(add.getByText("The end date can't be before the start date.")).toBeVisible()
  await expect(add.getByLabel("Last day")).toHaveAttribute("aria-invalid", "true")
  await expect(add.getByLabel("What it is")).toHaveValue(label)

  await add.getByLabel("First day").fill(start)
  await add.getByLabel("Last day").fill(end)
  await add.getByRole("button", { name: "Add crunch period" }).click()
  await expect(toast(page, `Added ${label}`)).toBeVisible()
  const upcoming = page.getByRole("list", { name: "Now and coming up" })
  await expect(upcoming).toContainText(label)
  await expect(upcoming).toContainText(
    `${formatDate(start, "short")} – ${formatDate(end, "short")} · Starts ${formatDate(start, "short")}`,
  )

  await page.getByRole("button", { name: `Remove ${label} crunch period` }).click()
  await expect(toast(page, `Removed`)).toBeVisible()
  await expect(page.getByRole("button", { name: `Remove ${label} crunch period` })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Crunch periods", exact: true })).toBeFocused()
  await expect(page.getByText("No crunch periods yet")).toBeVisible()
  expect(errors).toEqual([])
})

test("a crunch period happening now is marked Now, without amber", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const label = e2eLabel("Finals")
  const end = addDays(today, 3)
  await createCrunchPeriod({
    person_id: me.id,
    label,
    start_date: addDays(today, -1),
    end_date: end,
  })
  await page.goto(`/people/${me.id}`)
  await waitForContent(page)

  const row = page
    .getByRole("list", { name: "Now and coming up" })
    .getByRole("listitem")
    .filter({ hasText: label })
  await expect(row).toContainText(`Happening now · ends ${formatDate(end, "short")}`)
  await expect(row.getByText("Now", { exact: true })).toBeVisible()
  // Amber is the "stale" status colour only (spec §7): a crunch period is neutral.
  await expect(row).not.toHaveClass(/stale/)
  await expect(row.locator('[class*="stale"]')).toHaveCount(0)
  expect(errors).toEqual([])
})
