import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { DisclosurePanel, DisclosureScope, DisclosureToggle } from "./disclosure"
import { EvidenceForm } from "./evidence-form"
import { HypothesisForm, aboutGroups } from "./hypothesis-form"
import { HypothesisItem } from "./hypothesis-item"
import type { HypothesisListItem } from "./types"

// Render the components on their own: no router, no Server Actions.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("./actions", () => ({
  createHypothesis: vi.fn(),
  updateHypothesis: vi.fn(),
  addHypothesisTest: vi.fn(),
  updateHypothesisTest: vi.fn(),
}))

const JOHN = "f294266f-162f-43dc-a6d6-81aa7192d182"
const SAM = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const FUND = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"
const HYPOTHESIS = "3c4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b"

const people = [
  { id: JOHN, name: "John LaRocco" },
  { id: SAM, name: "Sam Browning" },
]
const orgs = [
  { id: FUND, name: "Example Seed Fund", kind: "investor" as const },
  { id: ORG, name: "Example Construction Co.", kind: "customer" as const },
]

/** The <option> a select starts on. */
function selectedOption(value: string, label: string) {
  return new RegExp(`<option[^>]* value="${value}" selected="">${label}<`)
}

describe("HypothesisForm", () => {
  it("on an org's page: sends the org, asks only what we believe and how to test it", () => {
    const html = renderToStaticMarkup(
      <HypothesisForm mode="create" orgId={ORG} people={people} defaults={{ owner_id: JOHN }} />,
    )
    expect(html).toContain(`<input type="hidden" name="organization_id" value="${ORG}"/>`)
    expect(html).not.toContain('name="about"')
    expect(html).toMatch(selectedOption(JOHN, "John LaRocco"))
    for (const name of ["statement", "test_plan", "success_criterion"]) {
      expect(html).toContain(`name="${name}"`)
    }
    for (const name of ["result", "learning", "decision"]) {
      expect(html).not.toContain(`name="${name}"`)
    }
    expect(html).toContain('aria-required="true"')
    expect(html).toContain("Add hypothesis")
  })

  it("on the roll-up: asks who it's about, starting on the filter's audience", () => {
    const html = renderToStaticMarkup(
      <HypothesisForm
        mode="create"
        orgs={orgs}
        people={people}
        defaults={{ owner_id: JOHN, about: "customer" }}
      />,
    )
    expect(html).toContain('name="about"')
    expect(html).toMatch(selectedOption("customer", "Customers in general"))
    expect(html).not.toContain('name="organization_id"')
  })

  it("on the roll-up without a filter: makes you choose", () => {
    const html = renderToStaticMarkup(
      <HypothesisForm mode="create" orgs={orgs} people={people} defaults={{ about: "" }} />,
    )
    expect(html).toMatch(selectedOption("", "Choose…"))
  })

  it("editing: every field but the status, filled from the saved values", () => {
    const html = renderToStaticMarkup(
      <HypothesisForm
        mode="edit"
        hypothesisId={HYPOTHESIS}
        orgs={orgs}
        people={people}
        defaults={{
          statement: "Site managers will pay",
          about: ORG,
          owner_id: SAM,
          result: "Two of five asked",
          decision: "pivot",
        }}
      />,
    )
    expect(html).toContain(`<input type="hidden" name="id" value="${HYPOTHESIS}"/>`)
    expect(html).toMatch(selectedOption(ORG, "Example Construction Co."))
    expect(html).toMatch(selectedOption(SAM, "Sam Browning"))
    expect(html).toMatch(selectedOption("pivot", "Pivot"))
    expect(html).toContain("Two of five asked")
    expect(html).not.toContain('name="status"')
    expect(html).toContain("Save changes")
  })
})

describe("aboutGroups", () => {
  it("offers many of each kind first, then each org under its kind", () => {
    expect(aboutGroups(orgs)).toEqual([
      {
        label: "Many",
        options: [
          { value: "investor", label: "Investors in general" },
          { value: "customer", label: "Customers in general" },
        ],
      },
      { label: "One of our investors", options: [{ value: FUND, label: "Example Seed Fund" }] },
      {
        label: "One of our customers",
        options: [{ value: ORG, label: "Example Construction Co." }],
      },
    ])
  })

  it("leaves out a kind with no orgs", () => {
    expect(aboutGroups([]).map((g) => g.label)).toEqual(["Many"])
  })
})

describe("EvidenceForm", () => {
  const meetings = [{ id: "m1", label: "Wed, Oct 7, 2:00 PM" }]

  it("adds evidence: today's date, three outcomes, an optional meeting", () => {
    const html = renderToStaticMarkup(
      <EvidenceForm
        mode="create"
        hypothesisId={HYPOTHESIS}
        meetings={meetings}
        defaults={{ test_date: "2026-10-12" }}
      />,
    )
    expect(html).toContain(`name="hypothesis_id" value="${HYPOTHESIS}"`)
    expect(html).toContain('value="2026-10-12"')
    expect(html.match(/<input type="radio"[^>]* name="outcome"/g)).toHaveLength(3)
    expect(html).not.toContain(`checked=""`)
    expect(html).toMatch(selectedOption("", "Not from a meeting"))
    expect(html).toContain("Wed, Oct 7, 2:00 PM")
  })

  it("edits evidence with its saved values", () => {
    const html = renderToStaticMarkup(
      <EvidenceForm
        mode="edit"
        testId="t1"
        meetings={meetings}
        defaults={{
          test_date: "2026-10-07",
          outcome: "contradicts",
          evidence: "They have a budget freeze",
          org_meeting_id: "m1",
        }}
      />,
    )
    expect(html).toContain('name="id" value="t1"')
    expect(html).toMatch(/checked="" value="contradicts"/)
    expect(html).toContain("They have a budget freeze")
    expect(html).toMatch(selectedOption("m1", "Wed, Oct 7, 2:00 PM"))
  })

  it("explains an empty meeting list", () => {
    const html = renderToStaticMarkup(
      <EvidenceForm mode="create" hypothesisId={HYPOTHESIS} meetings={[]} defaults={{}} />,
    )
    expect(html).toContain("No meetings logged yet")
  })
})

describe("Disclosure", () => {
  it("links each toggle to the panel, which starts hidden", () => {
    const html = renderToStaticMarkup(
      <DisclosureScope>
        <DisclosureToggle>Add</DisclosureToggle>
        <DisclosureToggle>Add first</DisclosureToggle>
        <DisclosurePanel label="Add a hypothesis">form</DisclosurePanel>
      </DisclosureScope>,
    )
    const panelId = html.match(/<div id="([^"]+)" role="region"/)?.[1]
    expect(panelId).toBeTruthy()
    expect(html.match(new RegExp(`aria-controls="${panelId}"`, "g"))).toHaveLength(2)
    expect(html).toContain('aria-expanded="false"')
    expect(html).toMatch(/role="region" aria-label="Add a hypothesis" hidden=""/)
  })

  it("starts open when asked (?add=1)", () => {
    const html = renderToStaticMarkup(
      <DisclosureScope defaultOpen>
        <DisclosureToggle>Add</DisclosureToggle>
        <DisclosurePanel label="Add a hypothesis">form</DisclosurePanel>
      </DisclosureScope>,
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).not.toContain("hidden")
  })
})

describe("HypothesisItem", () => {
  const item: HypothesisListItem = {
    id: HYPOTHESIS,
    statement: "Site managers will pay for impact alerts",
    status: "validated",
    decision: "persevere",
    audience: "customer",
    org: { id: ORG, name: "Example Construction Co.", kind: "customer", archived: false },
    owner: { id: SAM, name: "Sam Browning", avatarUrl: null },
    evidence: {
      counts: { supports: 2, contradicts: 1, inconclusive: 0 },
      total: 3,
      latest: { testDate: "2026-10-07", outcome: "supports", evidence: "Asked for a price" },
    },
    archived: false,
    createdAt: "2026-10-01T00:00:00Z",
  }

  it("shows the statement as a link, its owner, status and evidence", () => {
    const html = renderToStaticMarkup(<HypothesisItem item={item} showLatest />)
    expect(html).toContain(`data-hypothesis-id="${HYPOTHESIS}"`)
    expect(html).toContain(`href="/hypotheses/${HYPOTHESIS}"`)
    expect(html).toContain("Sam Browning")
    expect(html).toContain("Validated")
    expect(html).toContain("bg-good-soft")
    expect(html).toContain("Persevere")
    expect(html).toContain("2 support, 1 contradicts")
    expect(html).toContain("Asked for a price")
  })

  it("on the roll-up: who it's about, or across many", () => {
    const withOrg = renderToStaticMarkup(<HypothesisItem item={item} showAbout />)
    expect(withOrg).toContain(`href="/customers/${ORG}"`)
    expect(withOrg).toContain("Last tested")
    const acrossMany = renderToStaticMarkup(
      <HypothesisItem item={{ ...item, org: null, owner: null }} showAbout />,
    )
    expect(acrossMany).toContain("Across customers")
    expect(acrossMany).toContain("No owner yet")
  })

  it("keeps Invalidated neutral (no red)", () => {
    const html = renderToStaticMarkup(<HypothesisItem item={{ ...item, status: "invalidated" }} />)
    expect(html).toContain("Invalidated")
    expect(html).not.toMatch(/text-overdue|bg-overdue|text-good|bg-good/)
  })
})
