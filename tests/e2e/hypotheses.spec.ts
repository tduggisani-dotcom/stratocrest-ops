import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import { admin, cleanUpE2eRows, createOrg, e2eLabel } from "./support/admin"
import { collectConsoleErrors, scrollsHorizontally, snap, waitForContent } from "./support/page"
import { teammateFor } from "./support/team"

/**
 * Outreach as hypothesis testing (spec §3 principle 2, §6.3 roll-up): a hypothesis logged on
 * an investor's page, its evidence and status, and the roll-up across investors and customers
 * (Untested / Validated / Invalidated). Hypotheses can't be deleted by teammates, so every one
 * here is "[e2e]" (or hangs off an "[e2e]" org) and the cleanup removes it with the secret key.
 */
test.afterEach(cleanUpE2eRows)

const UUID = "[0-9a-f-]{36}"

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

async function hypothesisByStatement(statement: string) {
  const { data, error } = await admin
    .from("hypotheses")
    .select("id, status, organization_id, audience, owner_id")
    .eq("statement", statement)
    .single()
  if (error) throw new Error(`Reading the hypothesis failed: ${error.message}`)
  return data
}

/** One of the roll-up's three sections. */
const rollupSection = (page: Page, status: "Untested" | "Validated" | "Invalidated") =>
  page.getByRole("region", { name: status, exact: true })

test("a hypothesis on an investor's page: evidence, Validated, then on the roll-up", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const today = todayEt()
  const orgName = e2eLabel("Maumee Fund")
  const org = await createOrg({
    kind: "investor",
    name: orgName,
    owner_id: me.id,
    next_step_date: addDays(today, 5),
  })
  const statement = e2eLabel("Seed funds here want 3 months of pilot data first")

  // 1. Add it from the investor's page (inline, no dialog).
  await page.goto(`/investors/${org.id}`)
  await waitForContent(page)
  const section = page.getByRole("region", { name: "Hypotheses" })
  await section.getByRole("button", { name: "Add hypothesis" }).click()
  const panel = page.getByRole("region", { name: `Add a hypothesis about ${orgName}` })
  await expect(panel).toBeVisible()
  const statementInput = panel.getByRole("textbox", { name: /^What do we believe\?/ })
  await expect(statementInput).toBeFocused()
  await statementInput.fill(statement)
  await expect(panel.getByLabel("Owner")).toHaveValue(me.id)
  await panel.getByLabel("How we'll test it").fill("Ask in the next two partner meetings")
  await panel.getByRole("button", { name: "Add hypothesis" }).click()
  await expect(toast(page, "Hypothesis added")).toBeVisible()
  const link = section.getByRole("link", { name: statement })
  await expect(link).toBeVisible()
  const created = await hypothesisByStatement(statement)
  expect(created).toMatchObject({
    status: "untested",
    organization_id: org.id,
    audience: "investor",
    owner_id: me.id,
  })
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)

  // 2. Its page: add evidence that supports it.
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/hypotheses/${UUID}$`))
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(statement)
  await waitForContent(page)
  const evidence = page.getByRole("region", { name: "Evidence", exact: true })
  await evidence.getByRole("button", { name: "Add evidence" }).click()
  await page.getByRole("radio", { name: /^Supports/ }).check()
  await page
    .getByRole("textbox", { name: /^What did we hear or see\?/ })
    .fill("Their partner said they need a quarter of pilot data")
  await expect(page.getByLabel(/^Date/)).toHaveValue(today)
  await page
    .getByRole("region", { name: "Add evidence" })
    .getByRole("button", { name: "Add evidence" })
    .click()
  await expect(toast(page, "Evidence added")).toBeVisible()
  await expect(evidence).toContainText("Their partner said they need a quarter of pilot data")
  await expect(evidence).toContainText("Supports")

  // 3. Mark it Validated (status menu, saved on a pick).
  const status = page.getByRole("button", { name: "Status: Untested" })
  if (mobile) await status.tap()
  else await status.click()
  await page.getByRole("menuitemradio", { name: /^Validated/ }).click()
  await expect(toast(page, "Marked Validated")).toBeVisible()
  await expect(page.getByRole("button", { name: "Status: Validated" })).toBeVisible()
  await expect.poll(async () => (await hypothesisByStatement(statement)).status).toBe("validated")
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)

  // 4. The roll-up lists it under Validated, linked to the investor.
  await page.goto("/hypotheses")
  await waitForContent(page)
  const validated = rollupSection(page, "Validated")
    .getByRole("listitem")
    .filter({
      has: page.getByRole("link", { name: statement }),
    })
  await expect(validated).toBeVisible()
  await expect(validated.getByRole("link", { name: orgName })).toHaveAttribute(
    "href",
    `/investors/${org.id}`,
  )
  await expect(validated).toContainText(me.name)
  await expect(validated).toContainText(/1 supports|Supports/)
  await expect(rollupSection(page, "Untested").getByRole("link", { name: statement })).toHaveCount(
    0,
  )
  await snap(page, testInfo, "hypotheses", { fullPage: true })
  expect(errors).toEqual([])
})

test("a hypothesis about customers in general shows under the Customers filter only", async ({
  page,
}, testInfo) => {
  const errors = collectConsoleErrors(page)
  const mobile = testInfo.project.name === "mobile"
  const me = await teammateFor(testInfo.project.name, "session")
  const statement = e2eLabel("Distributors will stock a liner for existing hard hats")

  await page.goto("/hypotheses")
  await waitForContent(page)
  await page.getByRole("button", { name: "Add hypothesis" }).first().click()
  const panel = page.getByRole("region", { name: "Add a hypothesis" })
  await panel.getByRole("textbox", { name: /^What do we believe\?/ }).fill(statement)
  await panel.getByRole("combobox", { name: /^Who is it about\?/ }).selectOption({
    label: "Customers in general",
  })
  await expect(panel.getByRole("combobox", { name: "Owner" })).toHaveValue(me.id)
  await panel.getByRole("button", { name: "Add hypothesis" }).click()
  await expect(toast(page, "Hypothesis added")).toBeVisible()
  expect(await hypothesisByStatement(statement)).toMatchObject({
    status: "untested",
    organization_id: null,
    audience: "customer",
  })

  const untested = rollupSection(page, "Untested")
  const item = untested.getByRole("listitem").filter({
    has: page.getByRole("link", { name: statement }),
  })
  await expect(item).toBeVisible()
  await expect(item).toContainText("Across customers")
  if (mobile) expect(await scrollsHorizontally(page)).toBe(false)

  const about = page.getByRole("region", { name: "Filters" }).getByRole("group", { name: "About" })
  await about.getByRole("link", { name: "Customers", exact: true }).click()
  await expect(page).toHaveURL(/[?&]audience=customer/)
  await waitForContent(page)
  await expect(untested.getByRole("link", { name: statement })).toBeVisible()

  await about.getByRole("link", { name: "Investors", exact: true }).click()
  await expect(page).toHaveURL(/[?&]audience=investor/)
  await waitForContent(page)
  await expect(page.getByRole("link", { name: statement })).toHaveCount(0)

  await about.getByRole("link", { name: "All", exact: true }).click()
  await expect(page).toHaveURL("/hypotheses")
  await waitForContent(page)
  await expect(untested.getByRole("link", { name: statement })).toBeVisible()
  expect(errors).toEqual([])
})
