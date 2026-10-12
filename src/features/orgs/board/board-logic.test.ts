import type { Active, ClientRect, Over, SensorContext } from "@dnd-kit/core"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_FILTERS } from "../filters"
import { testOrg } from "../list/test-org"
import {
  applyMove,
  boardAnnouncements,
  boardColumns,
  boardInstructions,
  columnKeyboardCoordinates,
  columnTarget,
  groupByStage,
  stageLabelOf,
  toBoardCard,
  type BoardCard,
} from "./board-logic"
import { startsDrag } from "./board-sensors"

const A = "11111111-1111-4111-8111-111111111111"
const B = "33333333-3333-4333-8333-333333333333"
const C = "44444444-4444-4444-8444-444444444444"

function card(id: string, stage: string): BoardCard {
  const made = toBoardCard(testOrg({ id, stage, name: `Org ${id.slice(0, 1)}` }))
  if (!made) throw new Error("test card")
  return made
}

describe("toBoardCard", () => {
  it("keeps only what a card shows", () => {
    expect(toBoardCard(testOrg())).toEqual({
      id: A,
      name: "Example Seed Fund",
      stage: "meeting",
      owner: { name: "Sam Browning", avatarUrl: null },
      nextStep: "Send the deck, then ask for a partner meeting",
      nextStepDate: "2026-10-16",
      latestRating: 4,
      is_stale: false,
      days_since_contact: 9,
      last_contact_date: "2026-10-03",
    })
  })

  it("skips a row without its basics", () => {
    expect(toBoardCard(testOrg({ id: null }))).toBeNull()
    expect(toBoardCard(testOrg({ stage: null }))).toBeNull()
  })
})

describe("boardColumns", () => {
  it("has every stage of the kind, in pipeline order", () => {
    expect(boardColumns("investor", DEFAULT_FILTERS).map((c) => c.stage)).toEqual([
      "identified",
      "contacted",
      "meeting",
      "diligence",
      "committed",
      "passed",
    ])
    expect(boardColumns("customer", DEFAULT_FILTERS)).toHaveLength(7)
    expect(boardColumns("customer", DEFAULT_FILTERS).at(-2)).toEqual({
      stage: "converted",
      label: "Converted",
      outcome: "won",
    })
  })

  it("narrows to the filtered stages, still in pipeline order", () => {
    expect(
      boardColumns("investor", { stages: ["passed", "contacted"] }).map((c) => c.stage),
    ).toEqual(["contacted", "passed"])
  })
})

describe("groupByStage", () => {
  const columns = boardColumns("investor", DEFAULT_FILTERS)

  it("puts each card in its stage's column, keeping the list's order", () => {
    const groups = groupByStage(
      [card(B, "meeting"), card(A, "identified"), card(C, "meeting")],
      columns,
    )
    expect(groups.map((g) => [g.column.stage, g.cards.map((c) => c.id)])).toEqual([
      ["identified", [A]],
      ["contacted", []],
      ["meeting", [B, C]],
      ["diligence", []],
      ["committed", []],
      ["passed", []],
    ])
  })

  it("leaves out cards whose stage has no column", () => {
    const narrow = boardColumns("investor", { stages: ["meeting"] })
    expect(groupByStage([card(A, "identified"), card(B, "meeting")], narrow)[0]?.cards).toEqual([
      card(B, "meeting"),
    ])
  })
})

describe("applyMove", () => {
  it("changes only the moved card's stage, without reordering", () => {
    const cards = [card(A, "identified"), card(B, "meeting")]
    const moved = applyMove(cards, { orgId: A, stage: "diligence" })
    expect(moved.map((c) => [c.id, c.stage])).toEqual([
      [A, "diligence"],
      [B, "meeting"],
    ])
    expect(cards[0]?.stage).toBe("identified")
  })

  it("is a no-op for an unknown card", () => {
    const cards = [card(A, "identified")]
    expect(applyMove(cards, { orgId: C, stage: "passed" })).toEqual(cards)
  })

  it("lands the card in its new column after grouping (the optimistic board)", () => {
    const columns = boardColumns("investor", DEFAULT_FILTERS)
    const moved = applyMove([card(A, "identified"), card(B, "meeting")], {
      orgId: A,
      stage: "meeting",
    })
    const meeting = groupByStage(moved, columns).find((g) => g.column.stage === "meeting")
    expect(meeting?.cards.map((c) => c.id)).toEqual([A, B])
  })
})

describe("stageLabelOf", () => {
  it("labels known stages and passes unknown values through", () => {
    const label = stageLabelOf(boardColumns("customer", DEFAULT_FILTERS))
    expect(label("pilot_active")).toBe("Pilot Active")
    expect(label("somewhere")).toBe("somewhere")
  })
})

describe("columnTarget", () => {
  const order = ["identified", "contacted", "meeting"]

  it("moves right/down to the next column and left/up to the previous one", () => {
    expect(columnTarget(order, "contacted", "ArrowRight")).toBe("meeting")
    expect(columnTarget(order, "contacted", "ArrowDown")).toBe("meeting")
    expect(columnTarget(order, "contacted", "ArrowLeft")).toBe("identified")
    expect(columnTarget(order, "contacted", "ArrowUp")).toBe("identified")
  })

  it("stays put at either end", () => {
    expect(columnTarget(order, "meeting", "ArrowRight")).toBe("meeting")
    expect(columnTarget(order, "identified", "ArrowLeft")).toBe("identified")
  })

  it("ignores other keys and starts from the first column when lost", () => {
    expect(columnTarget(order, "contacted", "KeyA")).toBeNull()
    expect(columnTarget(order, "nowhere", "ArrowRight")).toBe("identified")
  })
})

describe("columnKeyboardCoordinates", () => {
  const rect = (left: number, top: number): ClientRect => ({
    left,
    top,
    width: 256,
    height: 400,
    right: left + 256,
    bottom: top + 400,
  })
  const context = (over: string | null, stage = "identified") =>
    ({
      active: { id: A, data: { current: { name: "Org 1", stage } } } as unknown as Active,
      over: over ? ({ id: over } as Over) : null,
      droppableRects: new Map([
        ["identified", rect(0, 100)],
        ["contacted", rect(268, 100)],
        ["meeting", rect(536, 100)],
      ]),
    }) as unknown as SensorContext
  const getter = columnKeyboardCoordinates(["identified", "contacted", "meeting"])
  const key = (code: string) => ({ code, preventDefault: vi.fn() }) as unknown as KeyboardEvent

  it("jumps the card just inside the next column", () => {
    const event = key("ArrowRight")
    expect(
      getter(event, { active: A, currentCoordinates: { x: 4, y: 140 }, context: context(null) }),
    ).toEqual({ x: 276, y: 108 })
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("starts from the column the card is over", () => {
    expect(
      getter(key("ArrowLeft"), {
        active: A,
        currentCoordinates: { x: 544, y: 108 },
        context: context("meeting"),
      }),
    ).toEqual({ x: 276, y: 108 })
  })

  it("leaves other keys to dnd-kit (Space drops, Escape cancels)", () => {
    expect(
      getter(key("Space"), {
        active: A,
        currentCoordinates: { x: 0, y: 0 },
        context: context(null),
      }),
    ).toBeUndefined()
  })
})

describe("boardAnnouncements", () => {
  const announce = boardAnnouncements(stageLabelOf(boardColumns("investor", DEFAULT_FILTERS)))
  const active = {
    id: A,
    data: { current: { name: "Example Fund", stage: "meeting" } },
  } as unknown as Active
  const over = (stage: string, label: string) =>
    ({ id: stage, data: { current: { label } } }) as unknown as Over

  it("says what was picked up and how to move it", () => {
    expect(announce.onDragStart({ active })).toBe(
      "Picked up Example Fund, in Meeting. Use the arrow keys to choose another stage, then press Space to drop it, or Escape to cancel.",
    )
  })

  it("says where it is and where it landed", () => {
    expect(announce.onDragOver({ active, over: over("diligence", "Diligence") })).toBe(
      "Example Fund is over Diligence.",
    )
    expect(announce.onDragOver({ active, over: null })).toBe("Example Fund is not over a stage.")
    expect(announce.onDragEnd({ active, over: over("diligence", "Diligence") })).toBe(
      "Dropped Example Fund in Diligence.",
    )
    expect(announce.onDragEnd({ active, over: over("meeting", "Meeting") })).toBe(
      "Dropped Example Fund. It stays in Meeting.",
    )
    expect(announce.onDragCancel({ active, over: null })).toBe(
      "Cancelled. Example Fund stays in Meeting.",
    )
  })

  it("keeps the pick-up instructions until the card leaves its own column", () => {
    const fresh = boardAnnouncements(stageLabelOf(boardColumns("investor", DEFAULT_FILTERS)))
    fresh.onDragStart({ active })
    expect(fresh.onDragOver({ active, over: over("meeting", "Meeting") })).toBeUndefined()
    expect(fresh.onDragOver({ active, over: over("diligence", "Diligence") })).toBe(
      "Example Fund is over Diligence.",
    )
    // Back home after leaving: said out loud.
    expect(fresh.onDragOver({ active, over: over("meeting", "Meeting") })).toBe(
      "Example Fund is over Meeting.",
    )
    // A new pick-up starts quiet again.
    fresh.onDragStart({ active })
    expect(fresh.onDragOver({ active, over: over("meeting", "Meeting") })).toBeUndefined()
  })

  it("names the kind in the instructions", () => {
    expect(boardInstructions("customer").draggable).toMatch(/^To move this customer/)
  })
})

describe("startsDrag", () => {
  it("allows events outside a DOM (nothing to check)", () => {
    expect(startsDrag({ target: null })).toBe(true)
  })
})
