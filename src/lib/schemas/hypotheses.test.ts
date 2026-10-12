import { describe, expect, it } from "vitest"
import {
  HYPOTHESIS_FORM_FIELDS,
  HYPOTHESIS_LIMITS,
  HYPOTHESIS_MESSAGES,
  hypothesisInputSchema,
  hypothesisStatusUpdateSchema,
  hypothesisTestInputSchema,
  hypothesisTestUpdateSchema,
  hypothesisUpdateSchema,
} from "@/lib/schemas/hypotheses"
import { tooLongMessage } from "@/lib/schemas/organizations"

const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const HYPOTHESIS = "8d951116-07ae-45e4-923f-ee0712f10a0d"
const TEST = "2eb27a4a-3821-4eae-9315-a1d046bc8c00"
const MEETING = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"

/** The first message per field, like the form shows. */
function errorsOf(schema: { safeParse: (input: unknown) => unknown }, input: unknown) {
  const result = schema.safeParse(input) as
    | { success: true }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message
  return errors
}

describe("hypothesisInputSchema", () => {
  it("accepts a statement about one org and starts Untested", () => {
    expect(
      hypothesisInputSchema.parse({ statement: "  They need test data  ", organization_id: ORG }),
    ).toEqual({ statement: "They need test data", organization_id: ORG, status: "untested" })
  })

  it("accepts a statement across many orgs with an audience", () => {
    const parsed = hypothesisInputSchema.parse({
      statement: "Distributors will trial it",
      audience: "customer",
    })
    expect(parsed.audience).toBe("customer")
    expect(parsed.organization_id).toBeUndefined()
  })

  it("asks what we believe and who it's about, both at once", () => {
    expect(errorsOf(hypothesisInputSchema, {})).toEqual({
      statement: HYPOTHESIS_MESSAGES.statement,
      audience: HYPOTHESIS_MESSAGES.audience,
    })
    expect(errorsOf(hypothesisInputSchema, { statement: " \n ", organization_id: "" })).toEqual({
      statement: HYPOTHESIS_MESSAGES.statement,
      audience: HYPOTHESIS_MESSAGES.audience,
    })
  })

  it("needs no audience when an org is linked (the database copies its kind)", () => {
    expect(errorsOf(hypothesisInputSchema, { statement: "x", organization_id: ORG })).toEqual({})
  })

  it("explains a bad org or audience instead of asking twice", () => {
    expect(errorsOf(hypothesisInputSchema, { statement: "x", organization_id: "nope" })).toEqual({
      organization_id: HYPOTHESIS_MESSAGES.organization,
    })
    expect(errorsOf(hypothesisInputSchema, { statement: "x", audience: "mentor" })).toEqual({
      audience: HYPOTHESIS_MESSAGES.audience,
    })
  })

  it("turns blank optional fields into null (cleared) and keeps missing ones undefined", () => {
    const parsed = hypothesisInputSchema.parse({
      statement: "x",
      audience: "investor",
      test_plan: "  ",
      success_criterion: "",
      owner_id: "",
      decision: "",
      learning: " Ask earlier ",
    })
    expect(parsed).toMatchObject({
      test_plan: null,
      success_criterion: null,
      owner_id: null,
      decision: null,
      learning: "Ask earlier",
    })
    expect(parsed.result).toBeUndefined()
  })

  it("checks owner, status and decision values", () => {
    expect(
      errorsOf(hypothesisInputSchema, {
        statement: "x",
        audience: "investor",
        owner_id: "someone",
        status: "maybe",
        decision: "wait",
      }),
    ).toEqual({
      owner_id: HYPOTHESIS_MESSAGES.owner,
      status: HYPOTHESIS_MESSAGES.status,
      decision: HYPOTHESIS_MESSAGES.decision,
    })
    expect(
      hypothesisInputSchema.parse({
        statement: "x",
        audience: "investor",
        owner_id: OWNER,
        status: "validated",
        decision: "persevere",
      }),
    ).toMatchObject({ owner_id: OWNER, status: "validated", decision: "persevere" })
  })

  it("matches the database's length limits", () => {
    const long = (n: number) => "a".repeat(n)
    const atLimit = {
      statement: long(HYPOTHESIS_LIMITS.statement),
      audience: "customer",
      test_plan: long(HYPOTHESIS_LIMITS.test_plan),
      success_criterion: long(HYPOTHESIS_LIMITS.success_criterion),
      result: long(HYPOTHESIS_LIMITS.result),
      learning: long(HYPOTHESIS_LIMITS.learning),
    }
    expect(errorsOf(hypothesisInputSchema, atLimit)).toEqual({})
    const over = Object.fromEntries(
      Object.entries(atLimit).map(([key, value]) => [
        key,
        key === "audience" ? value : `${value}a`,
      ]),
    )
    expect(errorsOf(hypothesisInputSchema, over)).toEqual({
      statement: tooLongMessage(1000),
      test_plan: tooLongMessage(5000),
      success_criterion: tooLongMessage(2000),
      result: tooLongMessage(5000),
      learning: tooLongMessage(5000),
    })
  })
})

describe("hypothesisUpdateSchema", () => {
  it("needs the id and leaves missing fields alone", () => {
    expect(hypothesisUpdateSchema.parse({ id: HYPOTHESIS, learning: "x" })).toEqual({
      id: HYPOTHESIS,
      learning: "x",
    })
    expect(errorsOf(hypothesisUpdateSchema, { statement: "x" })).toEqual({
      id: HYPOTHESIS_MESSAGES.hypothesis,
    })
  })

  it("rejects a blank statement when one is sent", () => {
    expect(errorsOf(hypothesisUpdateSchema, { id: HYPOTHESIS, statement: "  " })).toEqual({
      statement: HYPOTHESIS_MESSAGES.statement,
    })
  })

  it("refuses to clear both the org and the audience", () => {
    expect(
      errorsOf(hypothesisUpdateSchema, { id: HYPOTHESIS, organization_id: "", audience: "" }),
    ).toEqual({ audience: HYPOTHESIS_MESSAGES.audience })
    // Unlinking the org alone keeps the audience it had.
    expect(errorsOf(hypothesisUpdateSchema, { id: HYPOTHESIS, organization_id: "" })).toEqual({})
    expect(
      errorsOf(hypothesisUpdateSchema, {
        id: HYPOTHESIS,
        organization_id: "",
        audience: "investor",
      }),
    ).toEqual({})
  })

  it("covers every field the form sends", () => {
    const shape = Object.keys(hypothesisUpdateSchema.shape)
    for (const field of HYPOTHESIS_FORM_FIELDS) expect(shape).toContain(field)
  })
})

describe("hypothesisStatusUpdateSchema", () => {
  it("takes an id and one of the three statuses", () => {
    expect(hypothesisStatusUpdateSchema.parse({ id: HYPOTHESIS, status: "invalidated" })).toEqual({
      id: HYPOTHESIS,
      status: "invalidated",
    })
    expect(errorsOf(hypothesisStatusUpdateSchema, { id: "x", status: "done" })).toEqual({
      id: HYPOTHESIS_MESSAGES.hypothesis,
      status: HYPOTHESIS_MESSAGES.status,
    })
  })
})

describe("hypothesisTestInputSchema", () => {
  const valid = {
    hypothesis_id: HYPOTHESIS,
    test_date: "2026-10-09",
    outcome: "supports",
    evidence: "They asked for the drop-test report.",
  }

  it("accepts evidence with or without a meeting", () => {
    expect(hypothesisTestInputSchema.parse(valid)).toEqual(valid)
    expect(hypothesisTestInputSchema.parse({ ...valid, org_meeting_id: MEETING })).toMatchObject({
      org_meeting_id: MEETING,
    })
    expect(hypothesisTestInputSchema.parse({ ...valid, org_meeting_id: "" })).toMatchObject({
      org_meeting_id: null,
    })
  })

  it("explains each missing field", () => {
    expect(errorsOf(hypothesisTestInputSchema, {})).toEqual({
      hypothesis_id: HYPOTHESIS_MESSAGES.hypothesis,
      test_date: HYPOTHESIS_MESSAGES.testDate,
      outcome: HYPOTHESIS_MESSAGES.outcome,
      evidence: HYPOTHESIS_MESSAGES.evidence,
    })
  })

  it("checks the date, the outcome and the evidence length", () => {
    expect(
      errorsOf(hypothesisTestInputSchema, {
        ...valid,
        test_date: "2026-02-30",
        outcome: "maybe",
        evidence: "a".repeat(5001),
        org_meeting_id: "meeting",
      }),
    ).toEqual({
      test_date: HYPOTHESIS_MESSAGES.testDate,
      outcome: HYPOTHESIS_MESSAGES.outcome,
      evidence: tooLongMessage(5000),
      org_meeting_id: HYPOTHESIS_MESSAGES.meeting,
    })
    expect(errorsOf(hypothesisTestInputSchema, { ...valid, test_date: "1999-10-09" })).toEqual({
      test_date: HYPOTHESIS_MESSAGES.dateRange,
    })
  })
})

describe("hypothesisTestUpdateSchema", () => {
  it("edits a test by its id (it can't move to another hypothesis)", () => {
    const parsed = hypothesisTestUpdateSchema.parse({
      id: TEST,
      hypothesis_id: HYPOTHESIS,
      test_date: " 2026-10-09 ",
      outcome: "contradicts",
      evidence: "No budget until Q2.",
    })
    expect(parsed).toEqual({
      id: TEST,
      test_date: "2026-10-09",
      outcome: "contradicts",
      evidence: "No budget until Q2.",
    })
    expect(errorsOf(hypothesisTestUpdateSchema, { ...parsed, id: "x" })).toEqual({
      id: HYPOTHESIS_MESSAGES.test,
    })
  })
})
