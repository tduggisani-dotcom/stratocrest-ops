import { describe, expect, it } from "vitest"
import { formatKrValue, krPercent, krProgress, krProgressText, progressPercent } from "./okr"

describe("krProgress", () => {
  it("measures from the start value to the target", () => {
    expect(krProgress({ startValue: 0, targetValue: 10, currentValue: 3 })).toBeCloseTo(0.3)
    expect(krProgress({ startValue: 2, targetValue: 12, currentValue: 7 })).toBeCloseTo(0.5)
  })

  it("clamps to 0..1", () => {
    expect(krProgress({ startValue: 0, targetValue: 10, currentValue: 15 })).toBe(1)
    expect(krProgress({ startValue: 5, targetValue: 10, currentValue: 2 })).toBe(0)
  })

  it("works for targets below the start", () => {
    expect(krProgress({ startValue: 100, targetValue: 50, currentValue: 75 })).toBeCloseTo(0.5)
    expect(krProgress({ startValue: 100, targetValue: 50, currentValue: 40 })).toBe(1)
  })

  it("doesn't divide by zero when target equals start", () => {
    expect(krProgress({ startValue: 5, targetValue: 5, currentValue: 5 })).toBe(1)
    expect(krProgress({ startValue: 5, targetValue: 5, currentValue: 4 })).toBe(0)
  })
})

describe("progressPercent", () => {
  it("rounds to a whole percent", () => {
    expect(progressPercent(0)).toBe(0)
    expect(progressPercent(0.3)).toBe(30)
    expect(progressPercent(1)).toBe(100)
  })

  it("shows 100 only when done, and more than 0 once started", () => {
    expect(progressPercent(0.996)).toBe(99)
    expect(progressPercent(0.004)).toBe(1)
  })
})

describe("krPercent", () => {
  it("is the whole percent from start to target", () => {
    expect(krPercent({ startValue: 0, targetValue: 10, currentValue: 4 })).toBe(40)
    expect(krPercent({ startValue: 12, targetValue: 8, currentValue: 10 })).toBe(50)
    expect(krPercent({ startValue: 0, targetValue: 3, currentValue: 1 })).toBe(33)
    expect(krPercent({ startValue: 0, targetValue: 10, currentValue: 25 })).toBe(100)
    expect(krPercent({ startValue: 0, targetValue: 10, currentValue: -3 })).toBe(0)
  })

  it("reads 99 just short of the target and 1 just after the start", () => {
    expect(krPercent({ startValue: 0, targetValue: 1000, currentValue: 996 })).toBe(99)
    expect(krPercent({ startValue: 0, targetValue: 1000, currentValue: 4 })).toBe(1)
    expect(krPercent({ startValue: 12, targetValue: 8, currentValue: 8.01 })).toBe(99)
    expect(krPercent({ startValue: 0, targetValue: 1000, currentValue: 1000 })).toBe(100)
  })
})

describe("key-result text", () => {
  it("formats values with their unit", () => {
    expect(formatKrValue(12500, "$")).toBe("$12,500")
    expect(formatKrValue(-5, "$")).toBe("-$5")
    expect(formatKrValue(40, "%")).toBe("40%")
    expect(formatKrValue(3, "meetings")).toBe("3 meetings")
    expect(formatKrValue(2.5, null)).toBe("2.5")
    expect(formatKrValue(7, "  ")).toBe("7")
  })

  it('reads "3 of 10 meetings"', () => {
    const kr = { startValue: 0, targetValue: 10, currentValue: 3 }
    expect(krProgressText({ ...kr, unit: "meetings" })).toBe("3 of 10 meetings")
    expect(krProgressText({ ...kr, unit: null })).toBe("3 of 10")
    expect(krProgressText({ ...kr, currentValue: 2000, targetValue: 10000, unit: "$" })).toBe(
      "$2,000 of $10,000",
    )
    expect(krProgressText({ ...kr, currentValue: 30, targetValue: 50, unit: "%" })).toBe(
      "30% of 50%",
    )
  })
})
