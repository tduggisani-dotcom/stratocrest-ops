import { describe, expect, it } from "vitest"
import {
  DEFAULT_HYPOTHESIS_FILTERS,
  hasActiveHypothesisFilters,
  parseHypothesisFilters,
  serializeHypothesisFilters,
} from "./filters"

const SAM = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"

describe("parseHypothesisFilters", () => {
  it("defaults when nothing is set", () => {
    expect(parseHypothesisFilters({})).toEqual(DEFAULT_HYPOTHESIS_FILTERS)
    expect(parseHypothesisFilters(null)).toEqual(DEFAULT_HYPOTHESIS_FILTERS)
  })

  it("reads audience, owner, archived and add", () => {
    expect(
      parseHypothesisFilters({ audience: "customer", owner: SAM, archived: "1", add: "true" }),
    ).toEqual({ audience: "customer", owner: SAM, archived: true, add: true })
  })

  it("accepts owner=none and normalises a person id", () => {
    expect(parseHypothesisFilters({ owner: "none" }).owner).toBe("none")
    expect(parseHypothesisFilters({ owner: SAM.toUpperCase() }).owner).toBe(SAM)
  })

  it("drops unknown values instead of failing", () => {
    expect(parseHypothesisFilters({ audience: "partner", owner: "sam", archived: "yes" })).toEqual(
      DEFAULT_HYPOTHESIS_FILTERS,
    )
  })

  it("takes the first of repeated params and reads URLSearchParams", () => {
    expect(parseHypothesisFilters({ audience: ["investor", "customer"] }).audience).toBe("investor")
    expect(parseHypothesisFilters(new URLSearchParams("audience=investor&add=1"))).toMatchObject({
      audience: "investor",
      add: true,
    })
  })
})

describe("serializeHypothesisFilters", () => {
  it("leaves out defaults", () => {
    expect(serializeHypothesisFilters(DEFAULT_HYPOTHESIS_FILTERS)).toBe("")
  })

  it("applies changes and drops add unless asked", () => {
    const filters = { audience: "customer" as const, owner: SAM, archived: false, add: true }
    expect(serializeHypothesisFilters(filters)).toBe(`audience=customer&owner=${SAM}`)
    expect(serializeHypothesisFilters(filters, { owner: null, archived: true })).toBe(
      "audience=customer&archived=1",
    )
    expect(serializeHypothesisFilters(filters, { add: true })).toBe(
      `audience=customer&owner=${SAM}&add=1`,
    )
  })

  it("round-trips through the parser", () => {
    const filters = { audience: "investor" as const, owner: "none", archived: true, add: false }
    expect(
      parseHypothesisFilters(new URLSearchParams(serializeHypothesisFilters(filters))),
    ).toEqual(filters)
  })
})

describe("hasActiveHypothesisFilters", () => {
  it("is true when anything narrows the roll-up, not counting the add form", () => {
    expect(hasActiveHypothesisFilters(DEFAULT_HYPOTHESIS_FILTERS)).toBe(false)
    expect(hasActiveHypothesisFilters({ ...DEFAULT_HYPOTHESIS_FILTERS, add: true })).toBe(false)
    expect(hasActiveHypothesisFilters({ ...DEFAULT_HYPOTHESIS_FILTERS, owner: "none" })).toBe(true)
    expect(hasActiveHypothesisFilters({ ...DEFAULT_HYPOTHESIS_FILTERS, archived: true })).toBe(true)
  })
})
