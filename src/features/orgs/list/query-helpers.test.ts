import { describe, expect, test } from "vitest"
import { likePattern, orderSteps, ratingCondition } from "./query-helpers"

describe("orderSteps", () => {
  test("the default sort is next step date, then name, then id", () => {
    expect(orderSteps("next_step", "asc")).toEqual([
      { column: "next_step_date", ascending: true },
      { column: "name", ascending: true },
      { column: "id", ascending: true },
    ])
  })

  test("location sorts by city, then state or country, in the chosen direction", () => {
    expect(orderSteps("location", "desc")).toEqual([
      { column: "city", ascending: false },
      { column: "state_or_country", ascending: false },
      { column: "name", ascending: true },
      { column: "id", ascending: true },
    ])
  })

  test("sorting by name doesn't repeat the name tie-break", () => {
    expect(orderSteps("name", "desc")).toEqual([
      { column: "name", ascending: false },
      { column: "id", ascending: true },
    ])
  })

  test("each key maps to its org_overview column", () => {
    expect(orderSteps("owner", "asc")[0]?.column).toBe("owner_name")
    expect(orderSteps("stage", "asc")[0]?.column).toBe("stage_position")
    expect(orderSteps("rating", "desc")[0]).toEqual({ column: "latest_rating", ascending: false })
    expect(orderSteps("first_contact", "asc")[0]?.column).toBe("first_contact_date")
    expect(orderSteps("latest_meeting", "asc")[0]?.column).toBe("latest_meeting_at")
    expect(orderSteps("next_meeting", "asc")[0]?.column).toBe("next_meeting_at")
  })
})

describe("likePattern", () => {
  test("wraps the search in wildcards", () => {
    expect(likePattern("Ridge")).toBe("%Ridge%")
  })

  test("takes %, _ and backslash literally", () => {
    expect(likePattern("100%")).toBe("%100\\%%")
    expect(likePattern("a_b")).toBe("%a\\_b%")
    expect(likePattern("a\\b")).toBe("%a\\\\b%")
  })

  test("turns * (a PostgREST wildcard) into a one-character match", () => {
    expect(likePattern("A*B")).toBe("%A_B%")
  })

  test("leaves other punctuation alone", () => {
    expect(likePattern("Safety & Supply, Inc. (OH)")).toBe("%Safety & Supply, Inc. (OH)%")
  })
})

describe("ratingCondition", () => {
  test("off when nothing is picked", () => {
    expect(ratingCondition([])).toBeNull()
  })

  test("exact ratings, highest first", () => {
    expect(ratingCondition(["4", "5"])).toEqual({ kind: "in", values: [5, 4] })
  })

  test("'none' alone means no rated meeting yet", () => {
    expect(ratingCondition(["none"])).toEqual({ kind: "unrated" })
  })

  test("ratings plus 'none' become one OR filter", () => {
    expect(ratingCondition(["none", "1", "2"])).toEqual({
      kind: "in_or_unrated",
      expression: "latest_rating.in.(2,1),latest_rating.is.null",
    })
  })
})
