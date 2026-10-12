import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { OrgStageMenu } from "./stage-menu"

vi.mock("../stage-actions", () => ({ changeOrgStage: vi.fn() }))
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }))

const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"

describe("OrgStageMenu", () => {
  it("shows the current stage with the kind's label", () => {
    const html = renderToStaticMarkup(
      <OrgStageMenu kind="customer" orgId={ORG} orgName="Example Co." stage="pilot_active" />,
    )
    expect(html).toContain("Stage: </span>")
    expect(html).toContain(">Pilot Active<")
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).not.toContain("text-good")
  })

  it("marks a won stage green (the only stage colour)", () => {
    const html = renderToStaticMarkup(
      <OrgStageMenu kind="investor" orgId={ORG} orgName="Example Fund" stage="committed" />,
    )
    expect(html).toMatch(/text-good[^>]*>Committed</)
  })
})
