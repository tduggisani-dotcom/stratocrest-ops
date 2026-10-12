import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import {
  cleanUpE2eRows,
  createHypothesis,
  createMeeting,
  createOrg,
  e2eLabel,
} from "./support/admin"
import {
  animationsDone,
  collectConsoleErrors,
  offScreenTapTargets,
  scrollsHorizontally,
  smallTapTargets,
  snap,
  waitForContent,
} from "./support/page"
import { teammateFor } from "./support/team"

/**
 * The Stage 3 pages (investors, customers, meetings, hypotheses) with real rows in them. On
 * phones (390 px, CLAUDE.md): no sideways scroll, every link, button, summary and form control
 * in main at least 44 px, and nothing cut off at the screen's edge. On desktop: no sideways
 * page scroll (wide tables and the board scroll inside themselves).
 */
test.afterEach(cleanUpE2eRows)

/** Open every closed <details> in main, so the controls inside are measured too. */
async function openDisclosures(page: Page) {
  const closed = page.locator("main details:not([open]) > summary")
  for (let n = await closed.count(); n > 0; n--) await closed.first().click()
}

async function expectFits(page: Page, mobile: boolean, path: string) {
  await page.goto(path)
  await waitForContent(page)
  expect(await scrollsHorizontally(page), `${path} scrolls sideways`).toBe(false)
  if (!mobile) return
  await openDisclosures(page)
  expect(await scrollsHorizontally(page), `${path} scrolls sideways when opened`).toBe(false)
  expect(await smallTapTargets(page.locator("main")), `${path} has small tap targets`).toEqual([])
  expect(await offScreenTapTargets(page.locator("main")), `${path} hides controls`).toEqual([])
}

test("investor, customer, meeting and hypothesis pages fit the screen", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()

  const investor = await createOrg({
    kind: "investor",
    name: e2eLabel("Great Lakes Angel Collective of Northeast Ohio"),
    owner_id: me.id,
    next_step: "Send the one-page summary and the drop-test video to their managing partner",
    next_step_date: addDays(today, -1),
    stage: "meeting",
    subtype: "angel",
    region: "ohio",
    city: "Cleveland",
    contact_name: "Margaret Hollingsworth-Abernathy",
    contact_email: "margaret.hollingsworth-abernathy@greatlakesangelcollective.example.org",
    link: "https://www.linkedin.com/company/great-lakes-angel-collective-of-northeast-ohio-investors",
  })
  const past = await createMeeting(
    {
      organization_id: investor.id,
      starts_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      rating: 4,
      summary: "Strong interest; they asked for the pilot data and a follow-up in two weeks",
    },
    [me.id],
  )
  await createMeeting({
    organization_id: investor.id,
    starts_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  })
  const hypothesis = await createHypothesis(
    {
      statement: e2eLabel("Angel groups here invest only after a paid pilot"),
      organization_id: investor.id,
      owner_id: me.id,
    },
    [
      {
        test_date: today,
        outcome: "supports",
        evidence: "Two members said a paid pilot is a must",
      },
    ],
  )
  const customer = await createOrg({
    kind: "customer",
    name: e2eLabel("Riverside Construction"),
    owner_id: me.id,
    next_step_date: addDays(today, 2),
    stage: "pilot_proposed",
    subtype: "construction_firm",
  })

  const paths = [
    "/investors",
    "/investors?view=board",
    "/investors?region=ohio&sort=name&dir=asc",
    "/investors/new",
    `/investors/${investor.id}`,
    `/investors/${investor.id}/edit`,
    `/investors/${investor.id}/meetings/new`,
    `/investors/${investor.id}/meetings/${past.id}?logged=1`,
    `/investors/${investor.id}/meetings/${past.id}`,
    "/customers",
    "/customers?view=board",
    `/customers/${customer.id}`,
    "/hypotheses",
    "/hypotheses?add=1",
    `/hypotheses/${hypothesis.id}`,
  ]
  for (const path of paths) await expectFits(page, mobile, path)

  if (mobile) {
    // The phone filter sheet, open.
    await page.goto("/investors")
    await waitForContent(page)
    await page.getByRole("button", { name: "Filters", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Filter investors" })
    await expect(sheet).toBeVisible()
    await animationsDone(sheet)
    expect(await smallTapTargets(sheet)).toEqual([])
    expect(await scrollsHorizontally(page)).toBe(false)
    await snap(page, testInfo, "investors-filter-sheet")
    await sheet.getByRole("button", { name: "Close" }).click()

    // The org page's stage menu and archive confirmation.
    await page.goto(`/investors/${investor.id}`)
    await waitForContent(page)
    await page.getByRole("button", { name: "Stage: Meeting" }).tap()
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    await animationsDone(menu)
    await expect(menu).toBeInViewport({ ratio: 1 })
    expect(await smallTapTargets(menu)).toEqual([])
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Archive" }).click()
    await expect(page.getByRole("button", { name: /^Yes, archive/ })).toBeVisible()
    expect(await smallTapTargets(page.locator("main"))).toEqual([])
    expect(await scrollsHorizontally(page)).toBe(false)
    await page.getByRole("button", { name: "Cancel" }).click()
  }

  for (const [path, name] of [
    ["/investors", "investors"],
    ["/investors?view=board", "investors-board"],
    [`/investors/${investor.id}`, "investor-page-full"],
    ["/investors/new", "investor-new"],
    ["/customers", "customers"],
    ["/hypotheses", "hypotheses-rollup"],
  ] as const) {
    await page.goto(path)
    await waitForContent(page)
    await snap(page, testInfo, `layout-${name}`, { fullPage: true })
  }
  // One in dark mode.
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/investors")
  await waitForContent(page)
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/)
  await snap(page, testInfo, "layout-investors-dark", { fullPage: true })
  expect(errors).toEqual([])
})
