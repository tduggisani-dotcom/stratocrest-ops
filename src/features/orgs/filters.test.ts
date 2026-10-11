import { describe, expect, test } from "vitest"
import { DEFAULT_FILTERS, hasActiveFilters, parseOrgFilters, serializeOrgFilters } from "./filters"

const SAM = "4f6c2a8e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"

describe("parseOrgFilters", () => {
  test("no params gives the defaults", () => {
    expect(parseOrgFilters("investor", {})).toEqual(DEFAULT_FILTERS)
    expect(parseOrgFilters("customer", undefined)).toEqual(DEFAULT_FILTERS)
  })

  test("reads comma-separated filters, sort and view", () => {
    const filters = parseOrgFilters("investor", {
      view: "board",
      stage: "meeting,diligence",
      owner: SAM.toUpperCase(),
      region: "ohio,midwest",
      rating: "5,4,none",
      stale: "1",
      q: "  Ridge  ",
      sort: "rating",
      dir: "desc",
    })
    expect(filters).toEqual({
      view: "board",
      stages: ["meeting", "diligence"],
      owners: [SAM],
      regions: ["ohio", "midwest"],
      ratings: ["5", "4", "none"],
      stale: true,
      q: "Ridge",
      archived: false,
      sort: "rating",
      dir: "desc",
    })
  })

  test("drops values that don't belong, including the other kind's stages", () => {
    const filters = parseOrgFilters("investor", {
      view: "kanban",
      stage: "meeting,pilot_active,nonsense",
      owner: "not-a-uuid," + SAM,
      region: "ohio,mars",
      rating: "6,0,3",
      sort: "password",
      dir: "sideways",
    })
    expect(filters.view).toBe("table")
    expect(filters.stages).toEqual(["meeting"])
    expect(filters.owners).toEqual([SAM])
    expect(filters.regions).toEqual(["ohio"])
    expect(filters.ratings).toEqual(["3"])
    expect(filters.sort).toBe("next_step")
    expect(filters.dir).toBe("asc")
  })

  test("a customer stage is kept for customers", () => {
    expect(parseOrgFilters("customer", { stage: "pilot_active" }).stages).toEqual(["pilot_active"])
  })

  test("repeated values collapse, and the search is capped at 100 characters", () => {
    const filters = parseOrgFilters("investor", { region: "ohio,ohio", q: "x".repeat(150) })
    expect(filters.regions).toEqual(["ohio"])
    expect(filters.q).toHaveLength(100)
  })

  test("takes the first of repeated query keys, and reads URLSearchParams", () => {
    expect(parseOrgFilters("investor", { stage: ["contacted", "meeting"] }).stages).toEqual([
      "contacted",
    ])
    const params = new URLSearchParams("stale=true&archived=1&region=international")
    const filters = parseOrgFilters("investor", params)
    expect(filters.stale).toBe(true)
    expect(filters.archived).toBe(true)
    expect(filters.regions).toEqual(["international"])
  })
})

describe("serializeOrgFilters", () => {
  test("defaults serialize to nothing", () => {
    expect(serializeOrgFilters(DEFAULT_FILTERS)).toBe("")
  })

  test("round-trips through parse", () => {
    const filters = parseOrgFilters("customer", {
      view: "board",
      stage: "discovery,pilot_active",
      owner: SAM,
      region: "rest_of_us",
      rating: "none",
      stale: "1",
      q: "Safety & Supply",
      archived: "1",
      sort: "name",
      dir: "desc",
    })
    const query = serializeOrgFilters(filters)
    expect(parseOrgFilters("customer", new URLSearchParams(query))).toEqual(filters)
  })

  test("applies changes, and writes sort and direction together", () => {
    expect(serializeOrgFilters(DEFAULT_FILTERS, { sort: "rating", dir: "desc" })).toBe(
      "sort=rating&dir=desc",
    )
    expect(serializeOrgFilters(DEFAULT_FILTERS, { dir: "desc" })).toBe("sort=next_step&dir=desc")
    expect(serializeOrgFilters(DEFAULT_FILTERS, { regions: ["ohio"], view: "board" })).toBe(
      "view=board&region=ohio",
    )
  })
})

describe("hasActiveFilters", () => {
  test("view and sort alone are not filters", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, view: "board", sort: "name" })).toBe(false)
  })

  test("any narrowing counts", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, stale: true })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "ridge" })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, archived: true })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, ratings: ["none"] })).toBe(true)
  })
})
