import { describe, expect, it } from "vitest"
import { UNDO_CHANGED_SINCE, undoErrorMessage } from "./undo-messages"

describe("undoErrorMessage", () => {
  it("says so when the task changed since (undo_activity refuses with 40001)", () => {
    expect(
      undoErrorMessage({
        code: "40001",
        message: 'This record has changed since (field "status").',
      }),
    ).toBe(UNDO_CHANGED_SINCE)
  })

  it("covers an undo that already happened, and a task that's gone", () => {
    expect(
      undoErrorMessage({ code: "23505", message: "This change has already been undone." }),
    ).toBe("That change was already undone.")
    expect(undoErrorMessage({ code: "P0002", message: "The record no longer exists." })).toMatch(
      /no longer exists/,
    )
  })

  it("falls back to the usual database messages", () => {
    expect(undoErrorMessage({ code: "42501", message: "permission denied" })).toBe(
      "You don't have access to do that. Try signing in again.",
    )
    expect(undoErrorMessage({ code: "XX000", message: "boom" })).toBe(
      "Couldn't undo. Please try again.",
    )
  })
})
