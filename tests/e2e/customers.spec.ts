import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import { orgStagesByKind } from "@/lib/labels"
import { cleanUpE2eRows, createOrg, e2eLabel, orgIdByName, readOrg } from "./support/admin"
import { openList, orgItem } from "./support/orgs"
import { collectConsoleErrors, scrollsHorizontally, snap, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * The Customer & Pilot Pipeline (spec §6.3): the same components as the investor tracker,
 * with customer subtypes and stages. Investors and customers never mix: an investor's id
 * under /customers is a not-found page, and the other way round.
 */
test.afterEach(cleanUpE2eRows)

const UUID = "[0-9a-f-]{36}"

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

/** The not-found page a streamed page shows (status 200 with noindex, as Next streams it). */
async function expectNotFound(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading)
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).not.toHaveCount(0)
}

test("add a customer: customer types and stages, a stage change from its page, then the list", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const name = e2eLabel("Hilltop Builders")

  await page.goto("/customers/new")
  await waitForContent(page)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add customer")
  // Customer types only.
  const type = page.getByLabel("Type")
  await expect(type.getByRole("option", { name: "Construction firm" })).toHaveCount(1)
  await expect(type.getByRole("option", { name: "VC" })).toHaveCount(0)
  await page.getByLabel(/^Name/).fill(name)
  await type.selectOption({ label: "Construction firm" })
  await page.getByRole("textbox", { name: /^Next step \(required\)/ }).fill("Book a site visit")
  await page.getByLabel(/^Next step date/).fill(addDays(today, 3))
  await page.locator("summary").filter({ hasText: "Need or focus" }).click()
  await page.getByLabel("Need or focus").fill("Crews of 50+, a 10-helmet pilot")
  await page.getByRole("button", { name: "Add customer" }).click()
  await expect(toast(page, "Customer added")).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/customers/${UUID}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
  await waitForContent(page)
  const id = await orgIdByName("customer", name)
  expect(await readOrg(id)).toMatchObject({
    kind: "customer",
    stage: "identified",
    subtype: "construction_firm",
    owner_id: me.id,
  })
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)

  // The stage menu lists the customer stages (no "Diligence"), and saves on a pick.
  const stageButton = page.getByRole("button", { name: "Stage: Identified" })
  if (mobile) await stageButton.tap()
  else await stageButton.click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await expect(menu.getByRole("menuitemradio")).toHaveText(
    orgStagesByKind.customer.map((s) => s.label),
  )
  await expect(menu.getByRole("menuitemradio", { name: "Diligence" })).toHaveCount(0)
  await menu.getByRole("menuitemradio", { name: "Discovery" }).click()
  const moved = toast(page, "Moved to Discovery")
  await expect(moved).toBeVisible()
  await expect(page.getByRole("button", { name: "Stage: Discovery" })).toBeVisible()
  await expect.poll(async () => (await readOrg(id)).stage).toBe("discovery")
  // Undo puts it back.
  await moved.getByRole("button", { name: "Undo" }).click()
  await expect(toast(page, "Back to Identified")).toBeVisible()
  await expect.poll(async () => (await readOrg(id)).stage).toBe("identified")
  await expect(page.getByRole("button", { name: "Stage: Identified" })).toBeVisible()

  // The list: a table on desktop, cards on phones, with the customer, its type and owner.
  await openList(page, "customer")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Customers")
  if (mobile) {
    await expect(page.getByRole("table")).toBeHidden()
  } else {
    const headers = page.getByRole("table").getByRole("columnheader")
    await expect(headers).toHaveText([
      "Company",
      "Location",
      "First contact",
      /^Meeting date/,
      "Coatl point of contact",
      "How it went",
      "Next step",
    ])
  }
  const item = orgItem(page, "customer", mobile, name)
  await expect(item).toContainText("Construction firm · Identified")
  await expect(item).toContainText(me.name)
  await expect(item).toContainText("Not rated")
  // The summary counts it under a customer stage.
  await expect(
    page.getByRole("region", { name: "Summary" }).getByRole("list", { name: "By stage" }),
  ).toContainText("Pilot Proposed")
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)
  await snap(page, testInfo, "customers-list", { fullPage: true })

  // Its link opens its page.
  await item.getByRole("link", { name, exact: true }).click()
  await expect(page).toHaveURL(`/customers/${id}`)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
  expect(errors).toEqual([])
})

test("investors and customers never mix", async ({ page }, testInfo) => {
  const errors = collectConsoleErrors(page)
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const investor = await createOrg({
    kind: "investor",
    name: e2eLabel("Shared Name Partners"),
    owner_id: me.id,
    next_step_date: addDays(today, 2),
  })
  const customerName = e2eLabel("Shared Name Builders")
  const customer = await createOrg({
    kind: "customer",
    name: customerName,
    owner_id: me.id,
    next_step_date: addDays(today, 2),
  })

  await expectNotFound(page, `/customers/${investor.id}`, "We couldn't find that customer")
  await expect(page.getByRole("link", { name: "See all customers" })).toHaveAttribute(
    "href",
    "/customers",
  )
  await expectNotFound(page, `/investors/${customer.id}`, "We couldn't find that investor")
  await expectNotFound(page, `/investors/${customer.id}/edit`, "We couldn't find that investor")
  await expectNotFound(page, "/customers/not-an-id", "We couldn't find that customer")

  // Each list shows only its own kind.
  await openList(page, "investor")
  await expect(page.getByRole("link", { name: customerName, exact: true })).toHaveCount(0)
  await openList(page, "customer")
  await expect(page.getByRole("link", { name: customerName, exact: true })).toBeVisible()

  // The browser logs nothing but the not-found pages themselves.
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([])
})
