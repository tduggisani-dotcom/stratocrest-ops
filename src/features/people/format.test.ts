import { describe, expect, it } from "vitest"
import {
  WEEKDAYS,
  availabilityBlockName,
  countBy,
  crunchTiming,
  formatClockTime,
  formatDateRange,
  formatTimeRange,
  groupByWeekday,
  keyResultProgress,
  plural,
  splitCrunchPeriods,
  toHourMinute,
  weekdayName,
  type AvailabilityBlock,
  type CrunchPeriodItem,
} from "@/features/people/format"

describe("weekdays", () => {
  it("lists ISO weekdays Monday first", () => {
    expect(WEEKDAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weekdayName(1)).toBe("Monday")
    expect(weekdayName(7)).toBe("Sunday")
  })
})

describe("formatClockTime", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:30:00", "12:30 AM"],
    ["09:00:00", "9:00 AM"],
    ["11:59", "11:59 AM"],
    ["12:00", "12:00 PM"],
    ["13:05", "1:05 PM"],
    ["23:59:00", "11:59 PM"],
  ])("%s -> %s", (time, expected) => {
    expect(formatClockTime(time)).toBe(expected)
  })

  it("formats a range with an en dash", () => {
    expect(formatTimeRange("09:00:00", "12:00:00")).toBe("9:00 AM – 12:00 PM")
  })

  it("trims seconds for time inputs", () => {
    expect(toHourMinute("09:30:00")).toBe("09:30")
    expect(toHourMinute("09:30")).toBe("09:30")
  })
})

const block = (overrides: Partial<AvailabilityBlock>): AvailabilityBlock => ({
  id: "b",
  weekday: 1,
  startTime: "09:00",
  endTime: "10:00",
  label: "class",
  note: null,
  ...overrides,
})

describe("groupByWeekday", () => {
  it("returns all seven days with blocks sorted by start time", () => {
    const days = groupByWeekday([
      block({ id: "c", weekday: 3, startTime: "14:00", endTime: "15:00" }),
      block({ id: "a", weekday: 1, startTime: "13:00", endTime: "17:00" }),
      block({ id: "b", weekday: 1, startTime: "09:00", endTime: "12:00" }),
      block({ id: "d", weekday: 7, startTime: "08:00", endTime: "09:00" }),
    ])
    expect(days.map((d) => d.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
    expect(days[0]!.blocks.map((b) => b.id)).toEqual(["b", "a"])
    expect(days[1]!.blocks).toEqual([])
    expect(days[2]!.blocks.map((b) => b.id)).toEqual(["c"])
    expect(days[6]!.blocks.map((b) => b.id)).toEqual(["d"])
  })
})

describe("availabilityBlockName", () => {
  it("names the block for its Remove button", () => {
    expect(
      availabilityBlockName(block({ weekday: 1, startTime: "09:00:00", label: "class" })),
    ).toBe("Monday 9:00 AM class block")
    expect(availabilityBlockName(block({ weekday: 5, startTime: "17:30", label: "work" }))).toBe(
      "Friday 5:30 PM work block",
    )
  })
})

const period = (id: string, startDate: string, endDate: string): CrunchPeriodItem => ({
  id,
  label: id,
  startDate,
  endDate,
})

describe("splitCrunchPeriods", () => {
  const today = "2026-10-11"

  it("puts current and upcoming first (soonest first) and keeps the last 3 past ones", () => {
    const { upcoming, past } = splitCrunchPeriods(
      [
        period("finals", "2026-12-07", "2026-12-18"),
        period("now", "2026-10-05", "2026-10-15"),
        period("ends-today", "2026-10-01", "2026-10-11"),
        period("p1", "2026-09-01", "2026-09-05"),
        period("p2", "2026-09-20", "2026-09-25"),
        period("p3", "2026-08-01", "2026-08-02"),
        period("p4", "2026-10-09", "2026-10-10"),
      ],
      today,
    )
    expect(upcoming.map((p) => [p.id, p.isCurrent])).toEqual([
      ["ends-today", true],
      ["now", true],
      ["finals", false],
    ])
    expect(past.map((p) => p.id)).toEqual(["p4", "p2", "p1"])
    expect(past.every((p) => !p.isCurrent)).toBe(true)
  })

  it("marks a period starting today as current", () => {
    const { upcoming } = splitCrunchPeriods([period("x", today, "2026-10-20")], today)
    expect(upcoming[0]!.isCurrent).toBe(true)
  })

  it("handles no periods", () => {
    expect(splitCrunchPeriods([], today)).toEqual({ upcoming: [], past: [] })
  })
})

describe("crunch period text", () => {
  const today = "2026-10-11"

  it("formats the date range", () => {
    expect(formatDateRange("2026-12-07", "2026-12-18")).toBe("Dec 7 – Dec 18")
    expect(formatDateRange("2026-12-07", "2026-12-07")).toBe("Dec 7")
  })

  it("describes when it happens", () => {
    expect(crunchTiming(period("a", "2026-10-01", "2026-10-15"), today)).toBe(
      "Happening now · ends Oct 15",
    )
    expect(crunchTiming(period("a", "2026-10-01", today), today)).toBe("Happening now · ends today")
    expect(crunchTiming(period("a", "2026-10-12", "2026-10-15"), today)).toBe("Starts tomorrow")
    expect(crunchTiming(period("a", "2026-12-07", "2026-12-18"), today)).toBe("Starts Dec 7")
    expect(crunchTiming(period("a", "2026-09-01", "2026-10-01"), today)).toBe("Ended Oct 1")
  })
})

describe("keyResultProgress", () => {
  it("measures from the start value to the target", () => {
    expect(keyResultProgress({ start: 0, target: 10, current: 4 })).toBe(40)
    expect(keyResultProgress({ start: 5, target: 15, current: 10 })).toBe(50)
  })

  it("works when the target is below the start", () => {
    expect(keyResultProgress({ start: 12, target: 8, current: 10 })).toBe(50)
  })

  it("clamps to 0–100", () => {
    expect(keyResultProgress({ start: 0, target: 10, current: 25 })).toBe(100)
    expect(keyResultProgress({ start: 0, target: 10, current: -3 })).toBe(0)
  })

  it("is 0 when the target equals the start (the database forbids it anyway)", () => {
    expect(keyResultProgress({ start: 3, target: 3, current: 3 })).toBe(0)
  })

  it("rounds to whole percent", () => {
    expect(keyResultProgress({ start: 0, target: 3, current: 1 })).toBe(33)
  })
})

describe("small helpers", () => {
  it("pluralizes", () => {
    expect(plural(1, "open task")).toBe("1 open task")
    expect(plural(0, "open task")).toBe("0 open tasks")
    expect(plural(2, "key result")).toBe("2 key results")
  })

  it("counts rows by key", () => {
    const counts = countBy([{ o: "a" }, { o: "b" }, { o: "a" }], (r) => r.o)
    expect(counts.get("a")).toBe(2)
    expect(counts.get("b")).toBe(1)
    expect(counts.get("c")).toBeUndefined()
  })
})
