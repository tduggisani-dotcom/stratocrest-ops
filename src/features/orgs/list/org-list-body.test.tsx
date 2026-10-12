import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { OrgSummary } from "../queries/list"
import { testOrg } from "./test-org"

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  getActivePeople: vi.fn(),
  listOrgs: vi.fn(),
  summarizeOrgs: vi.fn(),
  countArchivedOrgs: vi.fn(),
  OrgBoard: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ requireTeamMember: mocks.requireTeamMember }))
vi.mock("@/lib/data/people", () => ({ getActivePeople: mocks.getActivePeople }))
vi.mock("../queries/list", () => ({
  listOrgs: mocks.listOrgs,
  summarizeOrgs: mocks.summarizeOrgs,
  countArchivedOrgs: mocks.countArchivedOrgs,
}))
vi.mock("../board/org-board", () => ({ OrgBoard: mocks.OrgBoard }))
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
  default: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const { OrgListBody } = await import("./org-list-body")

const summary: OrgSummary = {
  total: 1,
  byStage: [{ stage: "meeting", label: "Meeting", count: 1 }],
  meetingsThisMonth: 2,
  averageRating: 4,
  followUpsDueThisWeek: 1,
}

async function render(
  params: Record<string, string> = {},
  kind: "investor" | "customer" = "investor",
) {
  const element = await OrgListBody({ kind, searchParams: Promise.resolve(params) })
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-12T16:00:00Z"))
  mocks.requireTeamMember.mockResolvedValue({ id: "me", name: "Sam Browning" })
  mocks.getActivePeople.mockResolvedValue([
    {
      id: "4f6c2a8e-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
      name: "Sam Browning",
      avatarUrl: null,
      role: "",
      sortOrder: 1,
    },
  ])
  mocks.listOrgs.mockResolvedValue([testOrg()])
  mocks.summarizeOrgs.mockResolvedValue(summary)
  mocks.countArchivedOrgs.mockResolvedValue(0)
  mocks.OrgBoard.mockReturnValue(<div data-testid="board" />)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("OrgListBody", () => {
  test("checks the teammate first, then lists with the URL's filters", async () => {
    await render({ region: "ohio", sort: "rating", dir: "desc" })
    expect(mocks.requireTeamMember).toHaveBeenCalledOnce()
    expect(mocks.listOrgs).toHaveBeenCalledWith(
      "investor",
      expect.objectContaining({ regions: ["ohio"], sort: "rating", dir: "desc" }),
    )
  })

  test("view switcher, summary, filters, then the table and the cards", async () => {
    const html = await render()
    const order = [
      "Investor views",
      "org-investor-summary",
      "org-investor-filters",
      "<table",
      '<ul aria-label="Investors"',
    ]
    const positions = order.map((marker) => html.indexOf(marker))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).toContain('aria-current="page"')
    expect(html).toContain(">1 Investor</h2>")
  })

  test("the board view renders the board with the same orgs and filters", async () => {
    const html = await render({ view: "board" })
    expect(html).toContain('data-testid="board"')
    expect(html).not.toContain("<table")
    expect(mocks.OrgBoard.mock.calls[0]?.[0]).toMatchObject({
      kind: "investor",
      orgs: [testOrg()],
      filters: expect.objectContaining({ view: "board" }),
    })
  })

  test("no orgs at all: the kind's empty state with an add button, nothing else", async () => {
    mocks.listOrgs.mockResolvedValue([])
    const html = await render({}, "customer")
    expect(html).toContain("No customers yet")
    expect(html).toContain('href="/customers/new"')
    expect(html).toContain("Add customer")
    expect(html).not.toContain("org-customer-filters")
    expect(mocks.summarizeOrgs).not.toHaveBeenCalled()
  })

  test("filters that match nothing: keep the filters, say so, offer to clear", async () => {
    mocks.listOrgs.mockResolvedValue([])
    mocks.summarizeOrgs.mockResolvedValue({ ...summary, total: 0 })
    const html = await render({ region: "international", view: "board" })
    expect(html).toContain("No investors match these filters")
    expect(html).toContain('href="/investors?view=board"')
    expect(html).toContain("org-investor-filters")
    expect(html).not.toContain("org-investor-summary")
    expect(mocks.OrgBoard).not.toHaveBeenCalled()
  })

  test("'Show archived (n)' only when something is archived; the archived list links back", async () => {
    expect(await render()).not.toContain("Show archived")
    mocks.countArchivedOrgs.mockResolvedValue(2)
    expect(await render({ region: "ohio" })).toContain(">Show archived (2)</a>")

    const archived = await render({ archived: "1" })
    expect(archived).toContain("Showing archived investors")
    expect(archived).toContain('href="/investors"')
    expect(archived).toContain("Back to active investors")
  })

  test("an empty archive has its own empty state", async () => {
    mocks.listOrgs.mockResolvedValue([])
    const html = await render({ archived: "1" })
    expect(html).toContain("No archived investors")
  })
})
