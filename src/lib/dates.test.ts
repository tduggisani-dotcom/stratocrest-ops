import { afterEach, describe, expect, it } from "vitest"
import {
  addDays,
  daysBetween,
  etMoment,
  formatDate,
  formatDateTime,
  formatTime,
  isIsoDate,
  isWithin,
  isoWeekday,
  relativeDay,
  sundayOnOrAfter,
  toEtDate,
  todayEt,
} from "@/lib/dates"

describe("todayEt / toEtDate", () => {
  it("is still yesterday in ET just after midnight UTC (EDT, UTC−4)", () => {
    expect(todayEt(new Date("2026-10-10T03:59:00Z"))).toBe("2026-10-09")
    expect(todayEt(new Date("2026-10-10T04:00:00Z"))).toBe("2026-10-10")
  })

  it("uses UTC−5 in winter (EST), including across the year end", () => {
    expect(todayEt(new Date("2027-01-01T04:59:00Z"))).toBe("2026-12-31")
    expect(todayEt(new Date("2027-01-01T05:00:00Z"))).toBe("2027-01-01")
  })

  it("follows the clock change on the night DST ends", () => {
    // 2026-11-01 01:59 EDT, then 00:30 EST the same day.
    expect(toEtDate("2026-11-01T05:59:00Z")).toBe("2026-11-01")
    expect(toEtDate("2026-11-01T03:59:00Z")).toBe("2026-10-31")
  })

  it("accepts a Date or an ISO string", () => {
    expect(toEtDate(new Date("2026-10-14T16:00:00Z"))).toBe("2026-10-14")
    expect(toEtDate("2026-10-14T16:00:00.000Z")).toBe("2026-10-14")
  })

  it("defaults to now", () => {
    expect(isIsoDate(todayEt())).toBe(true)
  })
})

describe("etMoment", () => {
  it("handles the day DST ends (2026-11-01): 9:00 ET is 14:00 UTC", () => {
    expect(etMoment("2026-10-31", "09:00").toISOString()).toBe("2026-10-31T13:00:00.000Z")
    expect(etMoment("2026-11-01", "09:00").toISOString()).toBe("2026-11-01T14:00:00.000Z")
  })

  it("handles the day DST starts (2027-03-14): 9:00 ET is 13:00 UTC", () => {
    expect(etMoment("2027-03-13", "09:00").toISOString()).toBe("2027-03-13T14:00:00.000Z")
    expect(etMoment("2027-03-14", "09:00").toISOString()).toBe("2027-03-14T13:00:00.000Z")
  })

  it("handles midnight and late evening", () => {
    expect(etMoment("2026-12-31", "00:00").toISOString()).toBe("2026-12-31T05:00:00.000Z")
    expect(etMoment("2026-12-31", "23:30").toISOString()).toBe("2027-01-01T04:30:00.000Z")
  })

  it.each([
    ["2026-02-30", "09:00"],
    ["2026-10-14", "9:00"],
    ["2026-10-14", "09:00:00"],
    ["10/14/2026", "09:00"],
  ])("rejects %s %s", (date, time) => {
    expect(() => etMoment(date, time)).toThrow(RangeError)
  })
})

describe("addDays", () => {
  it.each([
    ["2026-10-31", 1, "2026-11-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2027-01-01", -1, "2026-12-31"],
    ["2027-03-01", -1, "2027-02-28"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-10-31", 2, "2026-11-02"], // across the end of DST
    ["2027-03-13", 1, "2027-03-14"], // across the start of DST
    ["2026-10-07", 364, "2027-10-06"], // W1 → W48
    ["2026-10-14", 0, "2026-10-14"],
  ])("%s + %i days = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected)
  })

  it("rejects a date that doesn't exist", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError)
  })
})

describe("daysBetween", () => {
  it.each([
    ["2026-10-07", "2027-10-06", 364],
    ["2026-10-31", "2026-11-02", 2],
    ["2027-03-13", "2027-03-15", 2],
    ["2026-12-31", "2027-01-01", 1],
    ["2026-10-14", "2026-10-14", 0],
    ["2026-10-14", "2026-10-09", -5],
  ])("from %s to %s is %i", (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected)
  })
})

describe("isoWeekday / sundayOnOrAfter", () => {
  it.each([
    ["2026-10-12", 1],
    ["2026-10-14", 3],
    ["2026-10-17", 6],
    ["2026-10-18", 7],
    ["2028-02-29", 2],
  ])("%s is ISO weekday %i", (date, weekday) => {
    expect(isoWeekday(date)).toBe(weekday)
  })

  it.each([
    ["2026-10-09", "2026-10-11"], // Friday
    ["2026-10-11", "2026-10-11"], // a Sunday stays put
    ["2026-10-12", "2026-10-18"], // Monday
    ["2026-12-28", "2027-01-03"], // across the year end
    ["2026-10-31", "2026-11-01"], // the day DST ends
  ])("the Sunday on or after %s is %s", (date, sunday) => {
    expect(sundayOnOrAfter(date)).toBe(sunday)
  })
})

describe("isWithin", () => {
  it("includes both ends", () => {
    expect(isWithin("2026-10-14", "2026-10-14", "2027-01-13")).toBe(true)
    expect(isWithin("2027-01-13", "2026-10-14", "2027-01-13")).toBe(true)
    expect(isWithin("2027-01-14", "2026-10-14", "2027-01-13")).toBe(false)
    expect(isWithin("2026-10-13", "2026-10-14", "2027-01-13")).toBe(false)
  })
})

describe("formatDate", () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    // Assigning undefined would store the string "undefined".
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  it("formats each style", () => {
    expect(formatDate("2026-10-14", "short")).toBe("Oct 14")
    expect(formatDate("2026-10-14")).toBe("Wed, Oct 14")
    expect(formatDate("2026-10-14", "long")).toBe("Wednesday, October 14, 2026")
  })

  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago", "America/New_York", "UTC"])(
    "never shifts the day, even with the machine in %s",
    (tz) => {
      process.env.TZ = tz
      expect(formatDate("2027-01-01")).toBe("Fri, Jan 1")
      expect(formatDate("2026-11-01")).toBe("Sun, Nov 1")
      expect(formatDate("2027-03-14", "long")).toBe("Sunday, March 14, 2027")
    },
  )
})

describe("formatTime / formatDateTime", () => {
  // Intl may put a narrow no-break space before AM/PM; \s matches it.
  it("shows the ET wall-clock time on both sides of DST", () => {
    expect(formatTime(etMoment("2026-11-01", "09:00"))).toMatch(/^9:00\sAM$/)
    expect(formatTime("2027-03-14T13:00:00Z")).toMatch(/^9:00\sAM$/)
    expect(formatTime("2026-10-14T22:30:00Z")).toMatch(/^6:30\sPM$/)
  })

  it("shows the ET day, not the UTC day", () => {
    expect(formatDateTime("2026-10-15T01:00:00Z")).toMatch(/^Wed, Oct 14, 9:00\sPM$/)
  })
})

describe("relativeDay", () => {
  it.each([
    ["2026-10-09", "today"],
    ["2026-10-10", "tomorrow"],
    ["2026-10-08", "yesterday"],
    ["2026-10-12", "in 3 days"],
    ["2026-10-04", "5 days ago"],
    ["2026-11-01", "in 23 days"],
  ])("%s seen from 2026-10-09 is %s", (date, expected) => {
    expect(relativeDay(date, "2026-10-09")).toBe(expected)
  })

  it("counts across the year end", () => {
    expect(relativeDay("2027-01-01", "2026-12-31")).toBe("tomorrow")
    expect(relativeDay("2026-12-30", "2027-01-02")).toBe("3 days ago")
  })
})

describe("isIsoDate", () => {
  it.each(["2026-10-14", "2026-02-28", "2028-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each([
    "2026-02-30",
    "2027-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-10-32",
    "2026-1-01",
    "20261014",
    "2026-10-14T00:00",
    " 2026-10-14",
    "",
  ])("rejects %j", (value) => {
    expect(isIsoDate(value)).toBe(false)
  })
})
