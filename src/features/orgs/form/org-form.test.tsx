import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { OrgFormOptions } from "../queries/detail"
import { OrgForm } from "./org-form"

// Render the client component on its own: no router, no Server Actions.
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
vi.mock("../actions", () => ({ createOrg: vi.fn(), updateOrg: vi.fn() }))

const JOHN = "f294266f-162f-43dc-a6d6-81aa7192d182"
const SAM = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"

const options: OrgFormOptions = {
  people: [
    { id: JOHN, name: "John LaRocco" },
    { id: SAM, name: "Sam Browning" },
  ],
  keyResults: [
    { label: "Q1 · Raise a pre-seed", options: [{ value: "kr1", label: "10 meetings" }] },
  ],
  relatedOrgs: [{ value: "c1", label: "Example Construction Co." }],
}

/** The <option> that a select starts on. */
function selectedOption(value: string, label: string) {
  return new RegExp(`<option[^>]* value="${value}" selected="">${label}<`)
}

/** Every <details> element's opening tag. */
function detailsTags(html: string): string[] {
  return html.match(/<details[^>]*>/g) ?? []
}

describe("OrgForm (add)", () => {
  const html = renderToStaticMarkup(
    <OrgForm
      mode="create"
      kind="investor"
      options={options}
      defaults={{ owner_id: JOHN, next_step_date: "2026-10-19" }}
    />,
  )

  it("sends the kind and starts with the defaults", () => {
    expect(html).toContain('<input type="hidden" name="kind" value="investor"/>')
    expect(html).toMatch(selectedOption(JOHN, "John LaRocco"))
    expect(html).toContain('value="2026-10-19"')
    expect(html).toContain("Add investor")
  })

  it("asks for the required fields and labels the owner as the point of contact", () => {
    for (const name of ["name", "owner_id", "next_step", "next_step_date"]) {
      expect(html).toMatch(
        new RegExp(
          `name="${name}"[^>]*aria-required="true"|aria-required="true"[^>]*name="${name}"`,
        ),
      )
    }
    expect(html).toContain("Coatl point of contact")
  })

  it("offers only the investor types and no stage", () => {
    expect(html).toContain(">VC<")
    expect(html).toContain(">Grant program<")
    expect(html).not.toContain(">Construction firm<")
    expect(html).not.toContain('name="stage"')
  })

  it("tucks the optional groups away, with the kind's focus label", () => {
    const tags = detailsTags(html)
    expect(tags).toHaveLength(5)
    expect(tags.every((tag) => !tag.includes("open"))).toBe(true)
    expect(html).toContain("Check size or focus")
    expect(html).toContain("Same company on the customer list")
  })

  it("gives every control a label", () => {
    const ids = [...html.matchAll(/<(?:input|select|textarea)[^>]* id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThan(15)
    for (const id of ids) expect(html).toContain(`for="${id}"`)
  })
})

describe("OrgForm (edit)", () => {
  const html = renderToStaticMarkup(
    <OrgForm
      mode="edit"
      kind="customer"
      orgId={ORG}
      options={options}
      defaults={{
        name: "Example Construction Co.",
        stage: "pilot_proposed",
        owner_id: SAM,
        next_step: "Send the pilot proposal",
        next_step_date: "2026-10-20",
        subtype: "construction_firm",
        region: "ohio",
      }}
    />,
  )

  it("sends the id and shows the customer stages with the current one picked", () => {
    expect(html).toContain(`<input type="hidden" name="id" value="${ORG}"/>`)
    expect(html).not.toContain('name="kind"')
    expect(html).toMatch(selectedOption("pilot_proposed", "Pilot Proposed"))
    expect(html).toContain(">Converted<")
    expect(html).not.toContain(">Diligence<")
    expect(html).toMatch(selectedOption("construction_firm", "Construction firm"))
    expect(html).toMatch(selectedOption("ohio", "Ohio"))
  })

  it("opens every group and uses the customer wording", () => {
    expect(detailsTags(html).every((tag) => tag.includes("open"))).toBe(true)
    expect(html).toContain("Need or focus")
    expect(html).toContain("Same company on the investor list")
    expect(html).toContain("Save changes")
    expect(html).toContain(`href="/customers/${ORG}"`)
  })
})
