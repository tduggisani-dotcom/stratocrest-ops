import { expect, type Locator, type Page } from "@playwright/test"
import { waitForContent } from "./page"

/**
 * Helpers for the investor and customer pages, which share one implementation: on desktop
 * the list is a table, below `md` it's a list of cards (both are in the page; CSS hides the
 * other one, so role-based locators only see the visible one).
 */

/** "investor" -> the list's accessible name and path. */
const KINDS = {
  investor: { plural: "Investors", path: "/investors" },
  customer: { plural: "Customers", path: "/customers" },
} as const

export type Kind = keyof typeof KINDS

/** The rows (desktop table body rows) or cards (phone list items) of the list. */
export function orgItems(page: Page, kind: Kind, mobile: boolean): Locator {
  const { plural } = KINDS[kind]
  return mobile
    ? page.getByRole("list", { name: plural, exact: true }).getByRole("listitem")
    : page.getByRole("table", { name: new RegExp(`^${plural}`) }).locator("tbody tr")
}

/** The row or card for the org called `name`. */
export function orgItem(page: Page, kind: Kind, mobile: boolean, name: string): Locator {
  return orgItems(page, kind, mobile).filter({
    has: page.getByRole("link", { name, exact: true }),
  })
}

/** Open the list (with `query`) and wait for it to stream in. */
export async function openList(page: Page, kind: Kind, query = ""): Promise<void> {
  await page.goto(`${KINDS[kind].path}${query}`)
  await waitForContent(page)
}

/**
 * Filter the list by one option ("Ohio" in "Region"): a link on desktop; on phones, a
 * checkbox in the Filters sheet, applied with "Show results".
 */
export async function filterBy(
  page: Page,
  kind: Kind,
  mobile: boolean,
  group: string,
  option: string,
): Promise<void> {
  if (mobile) {
    await page.getByRole("button", { name: "Filters", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: `Filter ${KINDS[kind].plural.toLowerCase()}` })
    await expect(sheet).toBeVisible()
    await sheet
      .getByRole("group", { name: group, exact: true })
      .getByRole("checkbox", { name: option, exact: true })
      .check()
    await sheet.getByRole("button", { name: "Show results" }).click()
    await expect(sheet).toBeHidden()
  } else {
    await page
      .getByRole("region", { name: "Filters" })
      .getByRole("group", { name: group, exact: true })
      .getByRole("link", { name: option, exact: true })
      .click()
  }
}

/** Parse RFC 4180 CSV (quoted fields, doubled quotes, CRLF) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      i++
    } else {
      cell += char
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
