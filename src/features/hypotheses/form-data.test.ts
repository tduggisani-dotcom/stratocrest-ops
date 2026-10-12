import { describe, expect, it } from "vitest"
import { hypothesisInputSchema, hypothesisUpdateSchema } from "@/lib/schemas/hypotheses"
import { readHypothesisForm, readHypothesisTestForm } from "./form-data"

const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const ID = "3c4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b"

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

describe("readHypothesisForm", () => {
  it("passes the org page's hidden organization_id through", () => {
    expect(readHypothesisForm(form({ statement: "S", organization_id: ORG }))).toEqual({
      statement: "S",
      organization_id: ORG,
    })
  })

  it("turns about=<kind> into an audience and clears the org", () => {
    expect(readHypothesisForm(form({ statement: "S", about: "customer" }))).toEqual({
      statement: "S",
      organization_id: "",
      audience: "customer",
    })
  })

  it("turns about=<org id> into the org (the database sets its audience)", () => {
    expect(readHypothesisForm(form({ statement: "S", about: ORG, audience: "investor" }))).toEqual({
      statement: "S",
      organization_id: ORG,
    })
  })

  it("sends both empty when about is blank, so the schema asks who it's about", () => {
    const values = readHypothesisForm(form({ statement: "S", about: " " }))
    expect(values).toEqual({ statement: "S", organization_id: "", audience: "" })
    const create = hypothesisInputSchema.safeParse(values)
    expect(create.success).toBe(false)
    expect(create.error?.issues.map((i) => i.path.join("."))).toEqual(["audience"])
    const update = hypothesisUpdateSchema.safeParse({ ...values, id: ID })
    expect(update.error?.issues.map((i) => i.path.join("."))).toEqual(["audience"])
  })

  it("keeps the edit form's id and leaves out fields it didn't send", () => {
    expect(readHypothesisForm(form({ id: ID, statement: "S", decision: "" }))).toEqual({
      id: ID,
      statement: "S",
      decision: "",
    })
  })
})

describe("readHypothesisTestForm", () => {
  it("reads the evidence fields and the add or edit id", () => {
    expect(
      readHypothesisTestForm(
        form({
          hypothesis_id: ID,
          test_date: "2026-10-12",
          outcome: "supports",
          evidence: "E",
          org_meeting_id: "",
          extra: "ignored",
        }),
      ),
    ).toEqual({
      hypothesis_id: ID,
      test_date: "2026-10-12",
      outcome: "supports",
      evidence: "E",
      org_meeting_id: "",
    })
  })
})
