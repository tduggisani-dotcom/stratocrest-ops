import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { CrunchPeriodView } from "@/features/people/format"
import { CrunchSection } from "./crunch-section"

// Render on its own: no Server Actions.
vi.mock("@/features/people/actions", () => ({
  addCrunchPeriod: vi.fn(),
  removeCrunchPeriod: vi.fn(),
}))
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }))

const TODAY = "2026-10-11"

function period(
  id: string,
  startDate: string,
  endDate: string,
  isCurrent: boolean,
): CrunchPeriodView {
  return { id, label: `Period ${id}`, startDate, endDate, isCurrent }
}

function render(upcoming: CrunchPeriodView[], past: CrunchPeriodView[] = []) {
  return renderToStaticMarkup(
    <CrunchSection
      personId="9121d9ea-4e09-4197-a954-7f5c2105f1b7"
      name="Sam Browning"
      upcoming={upcoming}
      past={past}
      today={TODAY}
    />,
  )
}

describe("CrunchSection", () => {
  it('marks a current period "Now" in neutral colours, not the amber "stale" colour', () => {
    const html = render(
      [
        period("a", "2026-10-01", "2026-10-15", true),
        period("b", "2026-12-07", "2026-12-18", false),
      ],
      [period("c", "2026-09-01", "2026-09-05", false)],
    )
    expect(html.match(/data-slot="badge"[^>]*>Now</g)).toHaveLength(1)
    expect(html).toContain("Happening now · ends Oct 15")
    expect(html).toContain("Starts Dec 7")
    expect(html).not.toMatch(/\b(text|bg|border)-stale/)
  })

  it("shows no marker when nothing is happening now", () => {
    const html = render([period("b", "2026-12-07", "2026-12-18", false)])
    expect(html).not.toContain(">Now<")
  })
})
