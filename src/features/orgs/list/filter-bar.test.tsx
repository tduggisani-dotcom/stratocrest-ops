import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"
import { DEFAULT_FILTERS, type OrgFilters } from "../filters"
import type { OrgSummary } from "../queries/list"
import { FilterBar } from "./filter-bar"
import { SummaryBar } from "./summary-bar"

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
vi.mock("next/form", () => ({
  default: ({
    action,
    children,
    scroll: _scroll,
    ...props
  }: {
    action: string
    children: React.ReactNode
    scroll?: boolean
  }) => (
    <form action={action} {...props}>
      {children}
    </form>
  ),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const SAM = "4f6c2a8e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
const owners = [{ id: SAM, name: "Sam Browning", avatarUrl: null }]

function bar(filters: Partial<OrgFilters> = {}, kind: "investor" | "customer" = "investor") {
  return renderToStaticMarkup(
    <FilterBar kind={kind} filters={{ ...DEFAULT_FILTERS, ...filters }} owners={owners} />,
  )
}

describe("FilterBar", () => {
  test("labelled groups of chips for stage, point of contact, region, rating and contact", () => {
    const html = bar()
    for (const legend of [
      "Stage",
      "Coatl point of contact",
      "Region",
      "Latest rating",
      "Contact",
    ]) {
      expect(html).toContain(`>${legend}</span>`)
    }
    expect(html.match(/role="group"/g)).toHaveLength(5)
    expect(html).toContain('href="/investors?region=ohio"')
    expect(html).toContain(`href="/investors?owner=${SAM}"`)
    expect(html).toContain('href="/investors?rating=none"')
    expect(html).toContain('href="/investors?stale=1"')
    expect(html).toContain(">Diligence</span>")
  })

  test("a customer list offers customer stages", () => {
    const html = bar({}, "customer")
    expect(html).toContain('href="/customers?stage=pilot_active"')
    expect(html).not.toContain("Diligence")
  })

  test("a chip that's on says so, and links to turning it off", () => {
    const html = bar({ regions: ["ohio"] })
    expect(html).toMatch(
      /<a href="\/investors" class="[^"]*bg-primary[^"]*">.*?Ohio<\/span><span class="sr-only"> \(on\)<\/span><\/a>/,
    )
  })

  test("Clear filters shows only when something narrows the list", () => {
    expect(bar()).not.toContain("Clear filters")
    expect(bar({ stale: true, sort: "name", dir: "desc" })).toContain(
      'href="/investors?sort=name&amp;dir=desc"',
    )
    expect(bar({ q: "ridge" })).toContain("Clear filters")
  })

  test("the search is a GET form to the list that keeps the other filters", () => {
    const html = bar({ regions: ["ohio", "midwest"], q: "ridge", sort: "rating", dir: "desc" })
    const form = /<form[^>]*>/.exec(html)?.[0] ?? ""
    expect(form).toContain('action="/investors"')
    expect(form).toContain('role="search"')
    expect(form).toContain('aria-label="Search investors"')
    expect(html).toContain('<input type="hidden" name="region" value="ohio,midwest"/>')
    expect(html).toContain('<input type="hidden" name="sort" value="rating"/>')
    expect(html).not.toContain('type="hidden" name="q"')
    expect(html).toMatch(/<input[^>]*name="q"[^>]*value="ridge"/)
    expect(html).toContain(
      '<label for="org-search-investor" class="sr-only">Search investors by name</label>',
    )
  })

  test("phones get a Filters button with the number of filters on", () => {
    const html = bar({ regions: ["ohio"], stale: true })
    expect(html).toMatch(/Filters<span[^>]*>2<span class="sr-only"> on<\/span><\/span>/)
  })
})

describe("SummaryBar", () => {
  const summary: OrgSummary = {
    total: 3,
    byStage: [
      { stage: "identified", label: "Identified", count: 0 },
      { stage: "meeting", label: "Meeting", count: 3 },
    ],
    meetingsThisMonth: 5,
    averageRating: 3.75,
    followUpsDueThisWeek: 2,
  }

  test("total, meetings this month, average rating, follow-ups due and every stage", () => {
    const html = renderToStaticMarkup(
      <SummaryBar kind="investor" summary={summary} overdueFollowUps={1} />,
    )
    expect(html).toContain('<dt class="text-xs text-muted-foreground">Investors</dt>')
    expect(html).toContain("Meetings this month")
    expect(html).toContain('3.8<span class="sr-only"> out of 5</span>')
    expect(html).toContain("Follow-ups due this week")
    expect(html).toContain("1 overdue")
    expect(html).toContain("text-overdue")
    expect(html).toMatch(/Identified<span[^>]*>0<\/span>/)
    expect(html).toMatch(/Meeting<span[^>]*>3<\/span>/)
  })

  test("no ratings yet, and singular wording for one", () => {
    const html = renderToStaticMarkup(
      <SummaryBar
        kind="customer"
        summary={{ ...summary, total: 1, averageRating: null }}
        overdueFollowUps={0}
      />,
    )
    expect(html).toContain(">Customer</dt>")
    expect(html).toContain("No ratings yet")
    expect(html).not.toContain("overdue")
  })
})
