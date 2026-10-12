import { describe, expect, it } from "vitest"
import { debriefState, displayLink, locationLine, telHref } from "./format"

describe("displayLink", () => {
  it.each([
    ["https://www.example.com/", "example.com"],
    ["https://example.com/team/", "example.com/team"],
    ["http://linkedin.com/in/jane-doe", "linkedin.com/in/jane-doe"],
    ["not a url", "not a url"],
  ])("%s → %s", (link, expected) => {
    expect(displayLink(link)).toBe(expected)
  })
})

describe("locationLine", () => {
  it("joins what's there", () => {
    expect(locationLine("Akron", "OH")).toBe("Akron, OH")
    expect(locationLine(null, "Germany")).toBe("Germany")
    expect(locationLine("Akron", " ")).toBe("Akron")
    expect(locationLine(null, null)).toBeNull()
  })
})

describe("telHref", () => {
  it("keeps the digits and a leading plus", () => {
    expect(telHref("+1 (330) 555-0100")).toBe("tel:+13305550100")
    expect(telHref("330.555.0100 ext 4")).toBe("tel:3305550100")
    expect(telHref("330-555-0100 x12")).toBe("tel:3305550100")
    expect(telHref("call Jane")).toBeNull()
  })
})

describe("debriefState", () => {
  const today = "2026-10-12"
  it("tells done, overdue, due today and upcoming apart", () => {
    expect(debriefState({ status: "done", dueDate: "2026-10-01" }, today)).toEqual({
      kind: "done",
    })
    expect(debriefState({ status: "due", dueDate: "2026-10-10" }, today)).toEqual({
      kind: "overdue",
      days: 2,
    })
    expect(debriefState({ status: "due", dueDate: today }, today)).toEqual({ kind: "due_today" })
    expect(debriefState({ status: "due", dueDate: "2026-10-13" }, today)).toEqual({
      kind: "upcoming",
    })
  })
})
