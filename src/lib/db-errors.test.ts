import { describe, expect, it } from "vitest"
import { friendlyDbError } from "@/lib/db-errors"

describe("friendlyDbError", () => {
  it("uses the fallback when there is no error or an unknown code", () => {
    expect(friendlyDbError(null)).toBe("Couldn't save. Please try again.")
    expect(friendlyDbError(undefined, "Couldn't add the task.")).toBe("Couldn't add the task.")
    expect(friendlyDbError({ code: "XX000", message: "internal" }, "Try again.")).toBe("Try again.")
    expect(friendlyDbError({ message: "fetch failed" })).toBe("Couldn't save. Please try again.")
  })

  it.each([
    ["23505", "Something with that name already exists."],
    ["23503", "Something this links to no longer exists. Refresh and try again."],
    ["23502", "A required field is missing."],
    ["42501", "You don't have access to do that. Try signing in again."],
    ["PGRST301", "You don't have access to do that. Try signing in again."],
    ["40001", "Someone changed this in the meantime. Refresh to see the latest version."],
  ])("explains code %s in plain language", (code, message) => {
    expect(friendlyDbError({ code, message: "raw database text" })).toBe(message)
  })

  it("passes on our own triggers' readable sentences", () => {
    const message = "An objective can have at most 4 key results."
    expect(friendlyDbError({ code: "P0001", message })).toBe(message)
    expect(friendlyDbError({ code: "23514", message })).toBe(message)
  })

  it("hides constraint names from people", () => {
    const raw = 'new row for relation "tasks" violates check constraint "tasks_title_check"'
    expect(friendlyDbError({ code: "23514", message: raw })).toBe(
      "Something in the form isn't valid. Check the highlighted fields.",
    )
    expect(friendlyDbError({ code: "P0001", message: raw })).not.toContain("tasks_title_check")
  })

  it("never shows the raw message for unexpected codes", () => {
    const raw = 'duplicate key value violates unique constraint "organizations_kind_name_key"'
    expect(friendlyDbError({ code: "23505", message: raw })).not.toContain("organizations")
  })
})
