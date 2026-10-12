import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"
import { DEFAULT_FILTERS, type OrgFilters } from "../filters"
import type { OrgListItem } from "../queries/list"
import { OrgCards } from "./org-cards"
import { OrgTable } from "./org-table"
import { testOrg } from "./test-org"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...props
  }: {
    href: string
    children: React.ReactNode
    scroll?: boolean
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const today = "2026-10-12"

function table(orgs: OrgListItem[], filters: Partial<OrgFilters> = {}) {
  return renderToStaticMarkup(
    <OrgTable
      kind="investor"
      orgs={orgs}
      filters={{ ...DEFAULT_FILTERS, ...filters }}
      today={today}
    />,
  )
}

function cards(orgs: OrgListItem[]) {
  return renderToStaticMarkup(<OrgCards kind="investor" orgs={orgs} today={today} />)
}

/** The visible text of each column header, in order. */
function headers(html: string): string[] {
  return [...html.matchAll(/<th scope="col"[^>]*>(.*?)<\/th>/g)].map((m) =>
    (m[1] ?? "")
      .replace(/<span class="sr-only">.*?<\/span>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim(),
  )
}

describe("OrgTable", () => {
  test("the spec's columns, in order", () => {
    expect(headers(table([testOrg()]))).toEqual([
      "Company",
      "Location",
      "First contact",
      "Meeting dateNext",
      "Coatl point of contact",
      "How it went",
      "Next step",
    ])
  })

  test("a row: company link and meta, location, first contact, meeting, owner, rating, next step", () => {
    const html = table([testOrg({ next_meeting_at: "2026-10-20T18:00:00Z" })])
    expect(html).toContain('href="/investors/11111111-1111-4111-8111-111111111111"')
    expect(html).toContain("Example Seed Fund")
    expect(html).toContain("VC · Meeting")
    expect(html).toContain("Columbus, OH")
    expect(html).toContain("Ohio")
    expect(html).toContain('<time dateTime="2026-09-02">Sep 2</time>')
    expect(html).toContain("Warm intro")
    expect(html).toContain('<time dateTime="2026-10-03">Oct 3</time>')
    expect(html).toContain(" · 9 days ago")
    expect(html).toContain(
      'Next: </span><time dateTime="2026-10-20T18:00:00Z" title="in 8 days">Oct 20, 2:00 PM</time>',
    )
    expect(html).toContain("Sam Browning")
    expect(html).toContain("Liked the pilot data, wants unit economics")
    expect(html).toContain('title="Liked the pilot data, wants unit economics"')
    expect(html).toContain("Send the deck, then ask for a partner meeting")
    // The company is the row header.
    expect(html).toMatch(/<th scope="row"[^>]*>.*Example Seed Fund/)
  })

  test("a strong rating is green; 1–3 stay neutral; none says Not rated", () => {
    const strong = table([testOrg({ latest_rating: 4 })])
    expect(strong).toMatch(/bg-good-soft text-good[^"]*"><span aria-hidden="true">4\/5<\/span>/)
    expect(strong).toContain("Rated 4 out of 5")

    const middling = table([testOrg({ latest_rating: 3 })])
    expect(middling).toContain("3/5")
    expect(middling).not.toContain("text-good")

    const none = table([testOrg({ latest_rating: null, latest_summary: null })])
    expect(none).toContain("Not rated")
  })

  test("overdue next step is red; a closed org's past date isn't", () => {
    const overdue = table([testOrg({ next_step_date: "2026-10-09", follow_up_overdue: true })])
    expect(overdue).toContain("text-overdue")
    expect(overdue).toContain("overdue 3 days ago")

    const won = table([
      testOrg({ next_step_date: "2026-10-09", stage: "committed", stage_outcome: "won" }),
    ])
    expect(won).not.toContain("text-overdue")
  })

  test("a stale org gets the amber marker, and only then", () => {
    const stale = table([testOrg({ is_stale: true, days_since_contact: 21 })])
    expect(stale).toContain("bg-stale-soft")
    expect(stale).toContain("No contact in 21 days")
    expect(table([testOrg()])).not.toContain("bg-stale-soft")
  })

  test("empty fields show a dash, read as 'Not set'", () => {
    const html = table([
      testOrg({
        city: null,
        state_or_country: null,
        region: null,
        first_contact_date: null,
        first_contact_method: null,
        latest_meeting_at: null,
        next_meeting_at: null,
      }),
    ])
    expect(html).toContain('<span class="sr-only">Not set</span>')
    expect(html).toContain("No meetings yet")
  })

  test("headers sort: aria-sort only on the current one, and links that keep the filters", () => {
    const html = table([testOrg()], { regions: ["ohio"], sort: "rating", dir: "desc" })
    expect(html.match(/aria-sort=/g)).toHaveLength(1)
    expect(html).toMatch(
      /<th scope="col" aria-sort="descending"[^>]*><a href="\/investors\?region=ohio&amp;sort=rating&amp;dir=asc"/,
    )
    expect(html).toContain('href="/investors?region=ohio&amp;sort=name&amp;dir=asc"')
    expect(html).toContain("Investors, sorted by latest rating, highest first")
  })

  test("the meeting column sorts by latest or next meeting", () => {
    const html = table([testOrg()], { sort: "next_meeting", dir: "asc" })
    expect(html).toContain('aria-sort="ascending"')
    expect(html).toContain('href="/investors?sort=next_meeting&amp;dir=desc"')
    expect(html).toContain('href="/investors?sort=latest_meeting&amp;dir=desc"')
    expect(html).toContain("Sort by next meeting")
  })

  test("archived orgs say so", () => {
    expect(table([testOrg({ archived_at: "2026-10-10T12:00:00Z" })])).toContain("Archived")
  })
})

describe("OrgCards", () => {
  test("company, location, meeting date, point of contact and rating, plus next step", () => {
    const html = cards([testOrg({ is_stale: true, days_since_contact: 15 })])
    expect(html).toContain('<ul aria-label="Investors"')
    expect(html).toContain('href="/investors/11111111-1111-4111-8111-111111111111"')
    expect(html).toContain("Columbus, OH · Ohio")
    expect(html).toContain("Oct 3")
    expect(html).toContain("Sam Browning")
    expect(html).toContain("Coatl point of contact: ")
    expect(html).toContain("4/5")
    expect(html).toContain("Send the deck")
    expect(html).toContain("No contact in 15 days")
  })

  test("the company link covers the card (a large tap target)", () => {
    expect(cards([testOrg()])).toMatch(
      /<a href="\/investors\/[^"]+" class="[^"]*after:absolute after:inset-0/,
    )
  })

  test("one card per org", () => {
    const html = cards([testOrg(), testOrg({ id: "33333333-3333-4333-8333-333333333333" })])
    expect(html.match(/<li /g)).toHaveLength(2)
  })
})
