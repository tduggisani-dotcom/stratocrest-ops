import { describe, expect, it } from "vitest"
import {
  keyResultLabel,
  orgMeetingLabel,
  pickOption,
  sessionLabel,
  teamMeetingLabel,
  truncateLabel,
  withCurrent,
} from "./options"

describe("sessionLabel", () => {
  it("reads week · day · topic", () => {
    expect(
      sessionLabel({
        week_label: "W2",
        start_date: "2026-10-14",
        end_date: "2026-10-14",
        topic: "Goal Setting & OKRs + CliftonStrengths",
        activity_type: "Workshop",
      }),
    ).toBe("W2 · Oct 14 · Goal Setting & OKRs + CliftonStrengths")
  })

  it("shows a date range and falls back to the activity type when there is no topic", () => {
    expect(
      sessionLabel({
        week_label: "W3",
        start_date: "2026-10-19",
        end_date: "2026-10-23",
        topic: null,
        activity_type: "Startup 360 Reviews",
      }),
    ).toBe("W3 · Oct 19 – Oct 23 · Startup 360 Reviews")
  })

  it("keeps long topics short enough for a phone's select", () => {
    const label = sessionLabel({
      week_label: "W5",
      start_date: "2026-11-04",
      end_date: "2026-11-04",
      topic: "OKR Share-out + Time & Team Management & Coachability + Running Mentor Meeting",
      activity_type: "Workshop",
    })
    expect(label.length).toBeLessThanOrEqual(72)
    expect(label.startsWith("W5 · Nov 4 · OKR Share-out")).toBe(true)
    expect(label.endsWith("…")).toBe(true)
  })
})

describe("truncateLabel", () => {
  it("collapses whitespace and only cuts when needed", () => {
    expect(truncateLabel("  a   b  ")).toBe("a b")
    expect(truncateLabel("abcdef", 6)).toBe("abcdef")
    expect(truncateLabel("abcdefg", 6)).toBe("abcde…")
  })
})

describe("teamMeetingLabel", () => {
  it("names the Sunday and says whether it is today, upcoming or past", () => {
    expect(teamMeetingLabel("2026-10-11", "2026-10-11")).toBe("Sun, Oct 11 (today)")
    expect(teamMeetingLabel("2026-10-18", "2026-10-11")).toBe("Sun, Oct 18 (upcoming)")
    expect(teamMeetingLabel("2026-10-04", "2026-10-11")).toBe("Sun, Oct 4")
  })
})

describe("orgMeetingLabel", () => {
  it("shows the org and the ET date and time", () => {
    expect(orgMeetingLabel("Example Safety Supply", "2026-10-14T19:00:00+00:00")).toBe(
      "Example Safety Supply · Wed, Oct 14, 3:00 PM",
    )
  })
})

describe("keyResultLabel", () => {
  it("prefixes the quarter when known", () => {
    expect(keyResultLabel("Book 10 investor meetings", "Q1")).toBe("Q1 · Book 10 investor meetings")
    expect(keyResultLabel("Book 10 investor meetings", null)).toBe("Book 10 investor meetings")
  })
})

describe("withCurrent", () => {
  const options = [{ value: "a", label: "A" }]

  it("adds the task's current link when the list leaves it out", () => {
    expect(withCurrent(options, { value: "old", label: "Old (archived)" })).toEqual([
      { value: "old", label: "Old (archived)" },
      { value: "a", label: "A" },
    ])
  })

  it("doesn't duplicate an option or add nothing", () => {
    expect(withCurrent(options, { value: "a", label: "A again" })).toEqual(options)
    expect(withCurrent(options, null)).toEqual(options)
  })
})

describe("pickOption", () => {
  const options = [{ value: "a", label: "A" }]

  it("keeps a prefilled id only when it is one of the choices", () => {
    expect(pickOption(options, "a")).toBe("a")
    expect(pickOption(options, ["a", "b"])).toBe("a")
    expect(pickOption(options, "b")).toBe("")
    expect(pickOption(options, undefined)).toBe("")
  })
})
