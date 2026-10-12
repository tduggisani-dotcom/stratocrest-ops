import { describe, expect, test } from "vitest"
import { DEFAULT_FILTERS, parseOrgFilters, type OrgFilters } from "../filters"
import {
  activeFilterCount,
  archivedToggleHref,
  ariaSort,
  clearFiltersHref,
  filterGroups,
  filtersFromForm,
  searchHiddenFields,
  sortDescription,
  sortDirectionHref,
  sortHref,
  sortKeyHref,
  staleToggleHref,
  toggled,
  viewHref,
} from "./filter-options"

const SAM = "4f6c2a8e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
const JOHN = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
const people = [
  { id: JOHN, name: "John LaRocco", avatarUrl: null },
  { id: SAM, name: "Sam Browning", avatarUrl: null },
]

function filters(changes: Partial<OrgFilters> = {}): OrgFilters {
  return { ...DEFAULT_FILTERS, ...changes }
}

describe("toggled", () => {
  test("adds a missing value and removes a present one", () => {
    expect(toggled(["a"], "b")).toEqual(["a", "b"])
    expect(toggled(["a", "b"], "a")).toEqual(["b"])
  })
})

describe("filterGroups", () => {
  test("stage, point of contact, region and rating, in that order", () => {
    const groups = filterGroups("investor", filters(), people)
    expect(groups.map((g) => g.legend)).toEqual([
      "Stage",
      "Coatl point of contact",
      "Region",
      "Latest rating",
    ])
    expect(groups[0]?.options.map((o) => o.label)).toEqual([
      "Identified",
      "Contacted",
      "Meeting",
      "Diligence",
      "Committed",
      "Passed",
    ])
    expect(groups[3]?.options.map((o) => o.label)).toEqual([
      "5/5",
      "4/5",
      "3/5",
      "2/5",
      "1/5",
      "Not rated",
    ])
  })

  test("uses the kind's own stages", () => {
    const stages = filterGroups("customer", filters(), people)[0]?.options.map((o) => o.value)
    expect(stages).toContain("pilot_active")
    expect(stages).not.toContain("diligence")
  })

  test("each option links to the list with it toggled, keeping everything else", () => {
    const current = filters({ regions: ["ohio"], sort: "rating", dir: "desc" })
    const [, owner, region] = filterGroups("investor", current, people)
    const ohio = region?.options.find((o) => o.value === "ohio")
    const midwest = region?.options.find((o) => o.value === "midwest")
    expect(ohio?.selected).toBe(true)
    expect(ohio?.href).toBe("/investors?sort=rating&dir=desc")
    expect(midwest?.selected).toBe(false)
    expect(midwest?.href).toBe("/investors?region=ohio%2Cmidwest&sort=rating&dir=desc")
    expect(owner?.options[1]).toMatchObject({ value: SAM, label: "Sam Browning", selected: false })
    expect(owner?.options[1]?.person?.name).toBe("Sam Browning")
  })

  test("an owner named in the URL who isn't on the active team still shows, so it can be removed", () => {
    const gone = "9f9f9f9f-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
    const owner = filterGroups("investor", filters({ owners: [gone] }), people)[1]
    expect(owner?.options.at(-1)).toMatchObject({ value: gone, selected: true, href: "/investors" })
  })
})

describe("links", () => {
  test("stale toggles on and off", () => {
    expect(staleToggleHref("investor", filters())).toBe("/investors?stale=1")
    expect(staleToggleHref("customer", filters({ stale: true }))).toBe("/customers")
  })

  test("clearing filters keeps the view and the sort", () => {
    const current = filters({
      view: "board",
      stages: ["meeting"],
      q: "ridge",
      archived: true,
      stale: true,
      sort: "name",
      dir: "desc",
    })
    expect(clearFiltersHref("investor", current)).toBe("/investors?view=board&sort=name&dir=desc")
  })

  test("the archived toggle starts from no filters", () => {
    expect(archivedToggleHref("investor", filters({ regions: ["ohio"] }))).toBe(
      "/investors?archived=1",
    )
    expect(archivedToggleHref("investor", filters({ archived: true }))).toBe("/investors")
  })

  test("switching view keeps the filters", () => {
    expect(viewHref("customer", filters({ regions: ["ohio"] }), "board")).toBe(
      "/customers?view=board&region=ohio",
    )
    expect(viewHref("customer", filters({ view: "board" }), "table")).toBe("/customers")
  })
})

describe("activeFilterCount", () => {
  test("counts each picked value and stale; search and archived aside", () => {
    expect(activeFilterCount(filters())).toBe(0)
    expect(
      activeFilterCount(
        filters({
          stages: ["meeting", "diligence"],
          owners: [SAM],
          regions: ["ohio"],
          ratings: ["none"],
          stale: true,
          q: "x",
          archived: true,
        }),
      ),
    ).toBe(6)
  })
})

describe("searchHiddenFields", () => {
  test("carries every other filter, the view and the sort, in URL format", () => {
    const current = filters({
      view: "board",
      stages: ["meeting", "diligence"],
      stale: true,
      q: "old search",
      sort: "rating",
      dir: "desc",
    })
    expect(searchHiddenFields(current)).toEqual([
      ["view", "board"],
      ["stage", "meeting,diligence"],
      ["stale", "1"],
      ["sort", "rating"],
      ["dir", "desc"],
    ])
    expect(searchHiddenFields(filters())).toEqual([])
  })

  test("submitting them with a new search reads back as the same filters", () => {
    const current = filters({ regions: ["ohio", "midwest"], owners: [SAM] })
    const params = new URLSearchParams(searchHiddenFields(current))
    params.set("q", "Ridge")
    expect(parseOrgFilters("investor", params)).toEqual({ ...current, q: "Ridge" })
  })
})

describe("filtersFromForm", () => {
  test("the checkboxes replace the facets and stale; search, view and sort stay", () => {
    const current = filters({
      view: "board",
      stages: ["contacted"],
      stale: true,
      q: "ridge",
      sort: "name",
      dir: "desc",
    })
    const form = new URLSearchParams()
    form.append("stage", "meeting")
    form.append("stage", "diligence")
    form.append("region", "ohio")
    form.append("rating", "none")
    form.append("owner", SAM)
    expect(filtersFromForm("investor", current, form)).toEqual({
      ...current,
      stages: ["meeting", "diligence"],
      owners: [SAM],
      regions: ["ohio"],
      ratings: ["none"],
      stale: false,
    })
  })

  test("drops values that don't belong to the kind", () => {
    const form = new URLSearchParams([
      ["stage", "pilot_active"],
      ["region", "mars"],
      ["stale", "on"],
    ])
    expect(filtersFromForm("investor", filters(), form)).toEqual(filters({ stale: true }))
  })
})

describe("sorting", () => {
  test("a header picks its most useful direction first, then flips", () => {
    expect(sortHref("investor", filters(), "rating")).toBe("/investors?sort=rating&dir=desc")
    expect(sortHref("investor", filters({ sort: "rating", dir: "desc" }), "rating")).toBe(
      "/investors?sort=rating&dir=asc",
    )
    expect(sortHref("investor", filters(), "name")).toBe("/investors?sort=name&dir=asc")
    // The default sort's header flips it to descending.
    expect(sortHref("investor", filters(), "next_step")).toBe("/investors?sort=next_step&dir=desc")
    expect(sortHref("investor", filters({ sort: "next_step", dir: "desc" }), "next_step")).toBe(
      "/investors",
    )
  })

  test("sorting keeps the filters", () => {
    expect(sortHref("customer", filters({ regions: ["ohio"] }), "owner")).toBe(
      "/customers?region=ohio&sort=owner&dir=asc",
    )
  })

  test("aria-sort only on the sorted column", () => {
    expect(ariaSort(filters(), ["next_step"])).toBe("ascending")
    expect(ariaSort(filters({ sort: "rating", dir: "desc" }), ["rating"])).toBe("descending")
    expect(ariaSort(filters(), ["name"])).toBeUndefined()
    expect(ariaSort(filters({ sort: "next_meeting" }), ["latest_meeting", "next_meeting"])).toBe(
      "ascending",
    )
  })

  test("describes a sort in words", () => {
    expect(sortDescription("next_step", "asc")).toBe("Next step date, soonest first")
    expect(sortDescription("rating", "desc")).toBe("Latest rating, highest first")
    expect(sortDescription("stage", "asc")).toBe("Stage, earliest first")
  })

  test("the sort menu: a key picks its most useful direction; the direction keeps the key", () => {
    expect(sortKeyHref("investor", filters({ regions: ["ohio"] }), "rating")).toBe(
      "/investors?region=ohio&sort=rating&dir=desc",
    )
    expect(sortKeyHref("investor", filters({ sort: "rating", dir: "desc" }), "next_step")).toBe(
      "/investors",
    )
    expect(sortDirectionHref("investor", filters({ sort: "rating", dir: "desc" }), "asc")).toBe(
      "/investors?sort=rating&dir=asc",
    )
  })
})
