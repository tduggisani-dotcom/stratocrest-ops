import { describe, expect, test } from "vitest"
import {
  averageRating,
  countMeetingsFor,
  etMonthMoments,
  etMonthRange,
  summarizeRows,
} from "./summary-math"

type Row = Parameters<typeof summarizeRows>[1][number]

function row(overrides: Partial<Row> = {}): Row {
  return {
    stage: "identified",
    latest_rating: null,
    stage_outcome: "open",
    next_step_date: "2026-10-30",
    ...overrides,
  }
}

describe("etMonthRange", () => {
  test("from the 1st of this month to the 1st of the next", () => {
    expect(etMonthRange("2026-10-12")).toEqual({ start: "2026-10-01", end: "2026-11-01" })
    expect(etMonthRange("2026-10-01")).toEqual({ start: "2026-10-01", end: "2026-11-01" })
    expect(etMonthRange("2026-10-31")).toEqual({ start: "2026-10-01", end: "2026-11-01" })
  })

  test("December rolls into January of the next year", () => {
    expect(etMonthRange("2026-12-15")).toEqual({ start: "2026-12-01", end: "2027-01-01" })
  })

  test("as moments: midnight ET, across a daylight-saving change", () => {
    // EDT (UTC-4) on Oct 1, EST (UTC-5) on Nov 1.
    expect(etMonthMoments("2026-10-12")).toEqual({
      from: "2026-10-01T04:00:00.000Z",
      to: "2026-11-01T04:00:00.000Z",
    })
    expect(etMonthMoments("2026-11-20")).toEqual({
      from: "2026-11-01T04:00:00.000Z",
      to: "2026-12-01T05:00:00.000Z",
    })
  })
})

describe("averageRating", () => {
  test("null when nothing is rated", () => {
    expect(averageRating([])).toBeNull()
    expect(averageRating([null, null])).toBeNull()
  })

  test("ignores orgs without a rating and rounds to one decimal", () => {
    expect(averageRating([5, null, 4])).toBe(4.5)
    expect(averageRating([4, 4, 3, 4])).toBe(3.8)
    expect(averageRating([5, 4, 4])).toBe(4.3)
    expect(averageRating([2])).toBe(2)
  })
})

describe("countMeetingsFor", () => {
  test("counts only meetings with the listed orgs (one id per meeting)", () => {
    expect(countMeetingsFor(["a", "b", "a", "c"], [{ id: "a" }, { id: "c" }])).toBe(3)
    expect(countMeetingsFor(["a"], [])).toBe(0)
  })
})

describe("summarizeRows", () => {
  // Monday, Oct 12, 2026: this week ends Sunday, Oct 18.
  const today = "2026-10-12"

  test("every stage of the kind, in pipeline order, zeros included", () => {
    const summary = summarizeRows(
      "investor",
      [row({ stage: "meeting" }), row({ stage: "meeting" }), row({ stage: "passed" })],
      today,
    )
    expect(summary.total).toBe(3)
    expect(summary.byStage).toEqual([
      { stage: "identified", label: "Identified", count: 0 },
      { stage: "contacted", label: "Contacted", count: 0 },
      { stage: "meeting", label: "Meeting", count: 2 },
      { stage: "diligence", label: "Diligence", count: 0 },
      { stage: "committed", label: "Committed", count: 0 },
      { stage: "passed", label: "Passed", count: 1 },
    ])
  })

  test("customers get the customer stages", () => {
    const summary = summarizeRows("customer", [], today)
    expect(summary.byStage.map((s) => s.stage)).toEqual([
      "identified",
      "contacted",
      "discovery",
      "pilot_proposed",
      "pilot_active",
      "converted",
      "lost",
    ])
    expect(summary).toMatchObject({ total: 0, averageRating: null, followUpsDueThisWeek: 0 })
  })

  test("average of the latest ratings among orgs that have one", () => {
    const summary = summarizeRows(
      "investor",
      [row({ latest_rating: 5 }), row({ latest_rating: 2 }), row()],
      today,
    )
    expect(summary.averageRating).toBe(3.5)
  })

  test("follow-ups due this week: open orgs due on or before Sunday, overdue included", () => {
    const summary = summarizeRows(
      "investor",
      [
        row({ next_step_date: "2026-10-01" }), // overdue
        row({ next_step_date: today }),
        row({ next_step_date: "2026-10-18" }), // Sunday
        row({ next_step_date: "2026-10-19" }), // next week
        row({ next_step_date: "2026-10-10", stage_outcome: "won", stage: "committed" }),
        row({ next_step_date: "2026-10-10", stage_outcome: "lost", stage: "passed" }),
      ],
      today,
    )
    expect(summary.followUpsDueThisWeek).toBe(3)
  })

  test("on a Sunday, this week ends today", () => {
    const summary = summarizeRows(
      "investor",
      [row({ next_step_date: "2026-10-18" }), row({ next_step_date: "2026-10-19" })],
      "2026-10-18",
    )
    expect(summary.followUpsDueThisWeek).toBe(1)
  })
})
