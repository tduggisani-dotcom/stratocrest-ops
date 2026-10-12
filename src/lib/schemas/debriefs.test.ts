import { describe, expect, test } from "vitest"
import { fieldErrorsFrom } from "@/lib/forms"
import { DEBRIEF_LIMITS, DEBRIEF_MESSAGES, debriefUpdateSchema } from "./debriefs"

const ID = "0b7d8a51-0f39-4a36-9a3d-1f0f1c2b9e44"
const ME = "f294266f-162f-43dc-a6d6-81aa7192d182"

function errors(input: unknown) {
  const result = debriefUpdateSchema.safeParse(input)
  return result.success ? {} : fieldErrorsFrom(result.error)
}

/** What the form sends. */
function form(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    planned: "",
    actual: "",
    worked: "",
    change: "",
    facilitator_id: "",
    ...overrides,
  }
}

describe("debriefUpdateSchema", () => {
  test("trims answers; blanks become null (cleared)", () => {
    expect(
      debriefUpdateSchema.parse(
        form({ planned: " Pitch the pilot ", actual: "They asked for data", facilitator_id: ME }),
      ),
    ).toEqual({
      id: ID,
      planned: "Pitch the pilot",
      actual: "They asked for data",
      worked: null,
      change: null,
      facilitator_id: ME,
    })
  })

  test("missing keys stay undefined (left as they are), for the API", () => {
    expect(debriefUpdateSchema.parse({ id: ID, worked: "The demo" })).toEqual({
      id: ID,
      worked: "The demo",
    })
  })

  test("saving a partial debrief keeps it due (no status sent)", () => {
    expect(debriefUpdateSchema.parse(form({ planned: "Intro" }))).not.toHaveProperty("status")
  })

  test("marking done needs at least one answer; reopening doesn't", () => {
    expect(errors(form({ status: "done" }))).toEqual({ planned: DEBRIEF_MESSAGES.emptyDone })
    expect(errors(form({ status: "done", change: "Bring the prototype" }))).toEqual({})
    expect(errors(form({ status: "due" }))).toEqual({})
    // Answers not sent are checked against the stored ones by the action.
    expect(errors({ id: ID, status: "done" })).toEqual({})
  })

  test("rejects unknown statuses, bad ids and over-long answers", () => {
    expect(errors(form({ status: "finished" })).status).toBe(DEBRIEF_MESSAGES.status)
    expect(errors(form({ id: "nope" })).id).toBe(DEBRIEF_MESSAGES.debrief)
    expect(errors(form({ facilitator_id: "nobody" })).facilitator_id).toBe(
      DEBRIEF_MESSAGES.facilitator,
    )
    expect(errors(form({ planned: "x".repeat(DEBRIEF_LIMITS.planned) }))).toEqual({})
    expect(errors(form({ planned: "x".repeat(DEBRIEF_LIMITS.planned + 1) })).planned).toMatch(
      /10,000 characters or fewer/,
    )
  })
})
