import { describe, expect, it } from "vitest"
import { newTaskHref, orgListHref, taskHref, taskReturnPath, tasksViewHref } from "./links"

describe("newTaskHref", () => {
  it("is plain /tasks/new without prefills", () => {
    expect(newTaskHref()).toBe("/tasks/new")
  })

  it("encodes prefills with the query names /tasks/new reads", () => {
    const href = newTaskHref({
      owner: "p1",
      due: "2026-10-14",
      org: "o1",
      session: "s1",
      kr: "k1",
      teamMeeting: "tm1",
      orgMeeting: "om1",
      returnTo: "/tasks?view=owner",
    })
    const url = new URL(href, "http://x.invalid")
    expect(url.pathname).toBe("/tasks/new")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      owner: "p1",
      due: "2026-10-14",
      org: "o1",
      session: "s1",
      kr: "k1",
      team_meeting: "tm1",
      org_meeting: "om1",
      return_to: "/tasks?view=owner",
    })
  })
})

describe("taskReturnPath", () => {
  it.each([
    ["/tasks?view=week", "/tasks?view=week"],
    ["/investors", "/investors"],
    ["/", "/"],
  ])("keeps the same-site path %s", (value, expected) => {
    expect(taskReturnPath(value)).toBe(expected)
  })

  it.each([undefined, null, "", "https://evil.example", "//evil.example", "/.//evil.example", 7])(
    "sends %j back to /tasks",
    (value) => {
      expect(taskReturnPath(value)).toBe("/tasks")
    },
  )

  it("uses the first of repeated params", () => {
    expect(taskReturnPath(["/people", "/okrs"])).toBe("/people")
  })
})

describe("other links", () => {
  it("builds task, view and org-list URLs", () => {
    expect(taskHref("abc")).toBe("/tasks/abc")
    expect(tasksViewHref("mine")).toBe("/tasks")
    expect(tasksViewHref("week")).toBe("/tasks?view=week")
    expect(orgListHref("investor")).toBe("/investors")
    expect(orgListHref("customer")).toBe("/customers")
  })
})
