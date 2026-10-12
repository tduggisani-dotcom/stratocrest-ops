import { describe, expect, it } from "vitest"
import { crunchPeriodsCovering, crunchWarning, type CrunchPeriod } from "@/lib/crunch"
import { formatDate } from "@/lib/dates"

const SAM = "sam"
const JOHN = "john"

const finals: CrunchPeriod = {
  personId: SAM,
  label: "Finals",
  startDate: "2026-12-07",
  endDate: "2026-12-18",
}
const deadline: CrunchPeriod = {
  personId: SAM,
  label: "Work deadline",
  startDate: "2026-12-18",
  endDate: "2026-12-20",
}
const johnsTrip: CrunchPeriod = {
  personId: JOHN,
  label: "Conference",
  startDate: "2026-12-10",
  endDate: "2026-12-10",
}
const periods = [finals, deadline, johnsTrip]

describe("crunchPeriodsCovering", () => {
  it("includes both the first and the last day of a period", () => {
    expect(crunchPeriodsCovering(periods, SAM, "2026-12-07")).toEqual([finals])
    expect(crunchPeriodsCovering(periods, SAM, "2026-12-17")).toEqual([finals])
  })

  it("is empty the day before and the day after", () => {
    expect(crunchPeriodsCovering(periods, SAM, "2026-12-06")).toEqual([])
    expect(crunchPeriodsCovering(periods, SAM, "2026-12-21")).toEqual([])
  })

  it("returns every overlapping period", () => {
    expect(crunchPeriodsCovering(periods, SAM, "2026-12-18")).toEqual([finals, deadline])
  })

  it("only looks at the owner's own periods", () => {
    expect(crunchPeriodsCovering(periods, JOHN, "2026-12-15")).toEqual([])
    expect(crunchPeriodsCovering(periods, JOHN, "2026-12-10")).toEqual([johnsTrip])
    expect(crunchPeriodsCovering(periods, "brad", "2026-12-10")).toEqual([])
  })

  it("handles a one-day period and periods across the year end", () => {
    const newYear: CrunchPeriod = {
      personId: SAM,
      label: "Travel",
      startDate: "2026-12-30",
      endDate: "2027-01-02",
    }
    expect(crunchPeriodsCovering([newYear], SAM, "2027-01-01")).toEqual([newYear])
    expect(crunchPeriodsCovering([newYear], SAM, "2027-01-03")).toEqual([])
  })

  it("is empty with no periods", () => {
    expect(crunchPeriodsCovering([], SAM, "2026-12-10")).toEqual([])
  })
})

describe("crunchWarning", () => {
  const short = (day: string) => formatDate(day, "short")

  it("names the owner by first name, the period and its dates", () => {
    expect(crunchWarning("Sam Browning", finals, short)).toBe(
      "The due date falls in Sam's crunch period: Finals (Dec 7 – Dec 18).",
    )
  })

  it("works for a one-word name and uses the given date format", () => {
    expect(crunchWarning("Tanush", johnsTrip, (day) => day)).toBe(
      "The due date falls in Tanush's crunch period: Conference (2026-12-10 – 2026-12-10).",
    )
  })
})
