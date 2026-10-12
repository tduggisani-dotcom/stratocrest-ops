import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { testOrg } from "../list/test-org"
import { boardColumns, toBoardCard, type BoardCard } from "./board-logic"
import { BoardView } from "./board-view"

vi.mock("../stage-actions", () => ({ changeOrgStage: vi.fn() }))
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }))

const TODAY = "2026-10-12"

function card(overrides: Parameters<typeof testOrg>[0]): BoardCard {
  const made = toBoardCard(testOrg(overrides))
  if (!made) throw new Error("test card")
  return made
}

function render(cards: BoardCard[], options: { readOnly?: boolean; stages?: string[] } = {}) {
  return renderToStaticMarkup(
    <BoardView
      kind="investor"
      cards={cards}
      columns={boardColumns("investor", { stages: options.stages ?? [] })}
      today={TODAY}
      readOnly={options.readOnly ?? false}
    />,
  )
}

/** The HTML of one column, from its section to the next. */
function column(html: string, stage: string): string {
  const start = html.indexOf(`data-board-column="${stage}"`)
  const end = html.indexOf("data-board-column=", start + 1)
  return html.slice(start, end === -1 ? undefined : end)
}

describe("BoardView", () => {
  const meeting = card({ name: "Example Fund", stage: "meeting" })

  it("shows one titled column per stage, with counts and a quiet empty line", () => {
    const html = render([meeting])
    for (const stage of ["identified", "passed"]) {
      expect(column(html, stage)).toContain("Nothing here")
    }
    expect(html.match(/<h3/g)).toHaveLength(6)
    expect(column(html, "meeting")).toMatch(/<h3[^>]*>Meeting<\/h3>/)
    expect(column(html, "meeting")).toContain('1<span class="sr-only"> investor</span>')
    expect(column(html, "meeting")).not.toContain("Nothing here")
  })

  it("links the card to the org and shows its owner", () => {
    const html = column(render([meeting]), "meeting")
    expect(html).toContain(`href="/investors/${meeting.id}"`)
    expect(html).toContain("Sam Browning")
    expect(html).toContain('draggable="false"')
  })

  it("gives every card a Move to menu, and no drag handle until the screen is known to be wide", () => {
    const html = render([meeting])
    expect(html).toContain("Move Example Fund to another stage")
    expect(html).toContain('data-board-control="menu"')
    expect(html).toContain("data-no-drag")
    expect(html).not.toContain('data-board-control="handle"')
  })

  it("is read-only for archived orgs", () => {
    expect(render([meeting], { readOnly: true })).not.toContain('data-board-control="menu"')
  })

  it("narrows columns to a stage filter", () => {
    const html = render([meeting], { stages: ["meeting", "diligence"] })
    expect(html.match(/<h3/g)).toHaveLength(2)
  })

  it("keeps won and lost columns calm: no green or red backgrounds", () => {
    const html = render([
      card({ stage: "committed", latest_rating: null }),
      card({ id: "33333333-3333-4333-8333-333333333333", stage: "passed", latest_rating: null }),
    ])
    const won = column(html, "committed")
    const lost = column(html, "passed")
    const sectionClass = (html: string) => /^[^>]*class="([^"]*)"/.exec(html)?.[1] ?? ""
    expect(sectionClass(won)).toContain("bg-muted/40")
    expect(won).toContain("text-good")
    for (const html of [won, lost]) {
      expect(sectionClass(html)).not.toMatch(/bg-good|bg-overdue|bg-destructive/)
    }
    expect(lost).not.toContain("text-good")
    expect(lost).not.toContain("text-overdue")
  })

  it("colours only status: overdue red, stale amber, strong rating green", () => {
    const overdue = render([
      card({
        next_step_date: "2026-10-01",
        latest_rating: 3,
        is_stale: true,
        days_since_contact: 20,
      }),
    ])
    expect(overdue).toContain("text-overdue")
    expect(overdue).toContain("bg-stale-soft")
    expect(overdue).toContain("No contact in 20 days")
    expect(overdue).not.toContain("bg-good-soft")
    expect(render([card({ latest_rating: 5 })])).toContain("bg-good-soft")
  })

  it("never calls a finished org's next step overdue", () => {
    const html = render([card({ stage: "committed", next_step_date: "2026-10-01" })])
    expect(html).not.toContain("text-overdue")
  })
})
