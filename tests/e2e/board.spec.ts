import { expect, test, type Page } from "@playwright/test"
import { addDays, todayEt } from "@/lib/dates"
import { cleanUpE2eRows, createOrg, e2eLabel, readOrg } from "./support/admin"
import {
  animationsDone,
  collectConsoleErrors,
  scrollsHorizontally,
  smallTapTargets,
  snap,
  waitForContent,
} from "./support/page"
import { teammateFor } from "./support/team"

/**
 * The board (spec §6.2: "Kanban by stage as a secondary view, with drag to change stage"):
 * drag with a mouse or the keyboard on desktop, the "Move to…" menu on phones. Each test adds
 * its own "[e2e]" investor in Contacted; the cleanup removes it.
 */
test.afterEach(cleanUpE2eRows)

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text })

/** A board column, by stage label. */
const column = (page: Page, label: string) => page.getByRole("region", { name: label, exact: true })

/** The card's company link inside a column's list. */
const cardIn = (page: Page, label: string, name: string) =>
  column(page, label).getByRole("link", { name, exact: true })

async function contactedInvestor(project: string) {
  const me = await teammateFor(project, "session")
  const name = e2eLabel("Cuyahoga Capital")
  const { id } = await createOrg({
    kind: "investor",
    name,
    owner_id: me.id,
    next_step_date: addDays(todayEt(), 6),
    stage: "contacted",
  })
  return { id, name }
}

async function openBoard(page: Page) {
  await page.goto("/investors?view=board")
  await waitForContent(page)
}

test("desktop: drag a card to another stage with the mouse, then Undo", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Dragging is for wide screens")
  const errors = collectConsoleErrors(page)
  const { id, name } = await contactedInvestor(testInfo.project.name)
  await openBoard(page)
  await expect(cardIn(page, "Contacted", name)).toBeVisible()
  expect(await scrollsHorizontally(page), "the page itself scrolls sideways").toBe(false)

  const handle = page.getByRole("button", { name: `Drag ${name}` })
  await handle.scrollIntoViewIfNeeded()
  const from = await handle.boundingBox()
  const to = await column(page, "Meeting").boundingBox()
  if (!from || !to) throw new Error("The card or the column isn't on screen")
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  // Drop at the handle's height (on screen), inside the target column.
  const drop = {
    x: to.x + to.width / 2,
    y: Math.max(to.y + 20, Math.min(start.y, to.y + to.height - 20)),
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 12, start.y + 12, { steps: 4 })
  await page.mouse.move(drop.x, drop.y, { steps: 12 })
  await page.mouse.up()

  const moved = toast(page, "Moved to Meeting")
  await expect(moved).toBeVisible()
  await expect(moved).toContainText(name)
  await expect(cardIn(page, "Meeting", name)).toBeVisible()
  await expect(cardIn(page, "Contacted", name)).toHaveCount(0)
  await expect.poll(async () => (await readOrg(id)).stage).toBe("meeting")

  await moved.getByRole("button", { name: "Undo" }).click()
  await expect(toast(page, "Back to Contacted")).toBeVisible()
  await expect.poll(async () => (await readOrg(id)).stage).toBe("contacted")
  await expect(cardIn(page, "Contacted", name)).toBeVisible()
  await snap(page, testInfo, "investors-board")
  expect(errors).toEqual([])
})

test("desktop: the keyboard drags too (Space, arrows, Space), with spoken instructions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Dragging is for wide screens")
  const errors = collectConsoleErrors(page)
  const { id, name } = await contactedInvestor(testInfo.project.name)
  await openBoard(page)

  const handle = page.getByRole("button", { name: `Drag ${name}` })
  await expect(handle).toHaveAccessibleDescription(/press Space to pick it up/)
  const live = page.locator('[id^="DndLiveRegion"]')
  await handle.focus()
  await page.keyboard.press("Space")
  await expect(live).toContainText(`Picked up ${name}, in Contacted.`)
  await page.keyboard.press("ArrowRight")
  await expect(live).toContainText(`${name} is over Meeting.`)
  await page.keyboard.press("ArrowRight")
  await expect(live).toContainText(`${name} is over Diligence.`)
  await page.keyboard.press("Space")
  await expect(live).toContainText(`Dropped ${name} in Diligence.`)

  await expect(toast(page, "Moved to Diligence")).toBeVisible()
  await expect.poll(async () => (await readOrg(id)).stage).toBe("diligence")
  await expect(cardIn(page, "Diligence", name)).toBeVisible()
  // Focus follows the card to its new column.
  await expect(
    column(page, "Diligence").getByRole("button", { name: `Drag ${name}` }),
  ).toBeFocused()

  // Escape cancels a pick-up: nothing moves.
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("Escape")
  await expect(live).toContainText(`Cancelled. ${name} stays in Diligence.`)
  await page.waitForTimeout(500)
  expect((await readOrg(id)).stage).toBe("diligence")
  expect(errors).toEqual([])
})

test("phone: the Move to… menu moves a card, and the board fits the screen", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "The menu is how phones move cards")
  const errors = collectConsoleErrors(page)
  const { id, name } = await contactedInvestor(testInfo.project.name)
  await openBoard(page)
  await expect(cardIn(page, "Contacted", name)).toBeVisible()
  // No drag handles on phones; columns stack, so nothing scrolls sideways.
  await expect(page.getByRole("button", { name: `Drag ${name}` })).toHaveCount(0)
  expect(await scrollsHorizontally(page), "the board scrolls sideways").toBe(false)
  expect(await smallTapTargets(page.locator("main"))).toEqual([])

  const moveButton = page.getByRole("button", { name: `Move ${name} to another stage` })
  await moveButton.tap()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await animationsDone(menu)
  await expect(menu.getByRole("menuitemradio", { name: "Contacted" })).toHaveAttribute(
    "aria-checked",
    "true",
  )
  expect(await smallTapTargets(menu)).toEqual([])
  await snap(page, testInfo, "board-move-menu")
  await menu.getByRole("menuitemradio", { name: "Committed" }).tap()

  await expect(toast(page, "Moved to Committed")).toBeVisible()
  await expect.poll(async () => (await readOrg(id)).stage).toBe("committed")
  await expect(cardIn(page, "Committed", name)).toBeVisible()
  await expect(cardIn(page, "Contacted", name)).toHaveCount(0)
  expect(await scrollsHorizontally(page)).toBe(false)
  expect(errors).toEqual([])
})
