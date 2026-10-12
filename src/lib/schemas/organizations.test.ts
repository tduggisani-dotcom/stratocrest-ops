import { describe, expect, it } from "vitest"
import {
  ORG_FORM_FIELDS,
  ORG_LIMITS,
  ORG_MESSAGES,
  orgCreateSchema,
  orgInputSchemaFor,
  orgKindMessages,
  orgUpdateSchemaFor,
  otherOrgKind,
  tooLongMessage,
  withHttps,
} from "@/lib/schemas/organizations"

const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const OTHER_ORG = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"
const KR = "5b0b6c55-0d7b-4c1e-9b8e-3f3f5f9b1a10"

const valid = {
  name: "Example Seed Fund",
  owner_id: OWNER,
  next_step: "Send the deck to Jane",
  next_step_date: "2026-10-20",
}

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

describe.each(["investor", "customer"] as const)("orgInputSchemaFor(%s)", (kind) => {
  const schema = orgInputSchemaFor(kind)
  const messages = orgKindMessages(kind)

  it("accepts the four required fields and starts at Identified", () => {
    expect(schema.parse(valid)).toEqual({ ...valid, stage: "identified" })
  })

  it("explains each missing required field", () => {
    expect(errorsOf(schema, {})).toEqual({
      name: messages.name,
      owner_id: ORG_MESSAGES.owner,
      next_step: ORG_MESSAGES.nextStep,
      next_step_date: ORG_MESSAGES.nextStepDate,
    })
  })

  it("rejects blank required text", () => {
    expect(errorsOf(schema, { ...valid, name: "   ", next_step: "\n\t" })).toEqual({
      name: messages.name,
      next_step: ORG_MESSAGES.nextStep,
    })
  })

  it("trims required and optional text", () => {
    const result = schema.parse({
      ...valid,
      name: "  Acme  ",
      next_step: " Call Jane ",
      contact_name: "  Jane Doe ",
      notes: "\n context \n",
    })
    expect(result).toMatchObject({
      name: "Acme",
      next_step: "Call Jane",
      contact_name: "Jane Doe",
      notes: "context",
    })
  })

  it("enforces the database's length limits", () => {
    const errors = errorsOf(schema, {
      ...valid,
      name: "x".repeat(ORG_LIMITS.name + 1),
      next_step: "x".repeat(ORG_LIMITS.next_step + 1),
      contact_phone: "1".repeat(ORG_LIMITS.contact_phone + 1),
      city: "x".repeat(ORG_LIMITS.city + 1),
      check_size_or_focus: "x".repeat(ORG_LIMITS.check_size_or_focus + 1),
      notes: "x".repeat(ORG_LIMITS.notes + 1),
    })
    expect(errors).toEqual({
      name: tooLongMessage(ORG_LIMITS.name),
      next_step: tooLongMessage(ORG_LIMITS.next_step),
      contact_phone: tooLongMessage(ORG_LIMITS.contact_phone),
      city: tooLongMessage(ORG_LIMITS.city),
      check_size_or_focus: tooLongMessage(ORG_LIMITS.check_size_or_focus),
      notes: "Use 20,000 characters or fewer.",
    })
    expect(schema.safeParse({ ...valid, name: "x".repeat(ORG_LIMITS.name) }).success).toBe(true)
  })

  it("accepts every stage of its kind", () => {
    for (const stage of kind === "investor"
      ? ["identified", "contacted", "meeting", "diligence", "committed", "passed"]
      : [
          "identified",
          "contacted",
          "discovery",
          "pilot_proposed",
          "pilot_active",
          "converted",
          "lost",
        ]) {
      expect(schema.parse({ ...valid, stage }).stage).toBe(stage)
    }
  })

  it("rejects the other kind's stages and unknown ones", () => {
    const foreign = kind === "investor" ? "pilot_active" : "diligence"
    expect(errorsOf(schema, { ...valid, stage: foreign })).toEqual({ stage: messages.stage })
    expect(errorsOf(schema, { ...valid, stage: "Meeting" })).toEqual({ stage: messages.stage })
  })

  it("accepts its own subtypes, rejects the other kind's, and clears a blank one", () => {
    const own = kind === "investor" ? ["vc", "angel", "grant_program"] : ["construction_firm"]
    for (const subtype of [...own, "other"]) {
      expect(schema.parse({ ...valid, subtype }).subtype).toBe(subtype)
    }
    const foreign = kind === "investor" ? "safety_distributor" : "vc"
    expect(errorsOf(schema, { ...valid, subtype: foreign })).toEqual({
      subtype: messages.subtype,
    })
    expect(schema.parse({ ...valid, subtype: "" }).subtype).toBeNull()
  })

  it("turns blank optional fields into null and leaves missing ones out", () => {
    const result = schema.parse({
      ...valid,
      contact_email: " ",
      link: "",
      region: "",
      first_contact_date: "",
      first_contact_method: "",
      key_result_id: "",
      related_organization_id: "  ",
    })
    expect(result).toMatchObject({
      contact_email: null,
      link: null,
      region: null,
      first_contact_date: null,
      first_contact_method: null,
      key_result_id: null,
      related_organization_id: null,
    })
    expect(schema.parse(valid)).not.toHaveProperty("contact_email")
  })

  it("checks email addresses", () => {
    expect(schema.parse({ ...valid, contact_email: " jane@example.com " }).contact_email).toBe(
      "jane@example.com",
    )
    for (const email of ["jane", "jane@", "jane@example", "jane doe@example.com"]) {
      expect(errorsOf(schema, { ...valid, contact_email: email })).toEqual({
        contact_email: ORG_MESSAGES.email,
      })
    }
  })

  it("accepts http(s) links, adds https:// to a bare domain, and refuses other schemes", () => {
    expect(schema.parse({ ...valid, link: "https://example.com/team" }).link).toBe(
      "https://example.com/team",
    )
    expect(schema.parse({ ...valid, link: "HTTP://example.com" }).link).toBe("HTTP://example.com")
    expect(schema.parse({ ...valid, link: "linkedin.com/in/jane" }).link).toBe(
      "https://linkedin.com/in/jane",
    )
    for (const link of [
      "javascript:alert(1)",
      "mailto:jane@example.com",
      "ftp://example.com",
      "not a link",
      "https://",
    ]) {
      expect(errorsOf(schema, { ...valid, link })).toEqual({ link: ORG_MESSAGES.link })
    }
    expect(
      errorsOf(schema, { ...valid, link: `https://example.com/${"x".repeat(ORG_LIMITS.link)}` }),
    ).toEqual({ link: "That link is too long. Use one under 2,048 characters." })
  })

  it("checks regions and how we first met", () => {
    expect(
      schema.parse({ ...valid, region: "rest_of_us", first_contact_method: "warm_intro" }),
    ).toMatchObject({ region: "rest_of_us", first_contact_method: "warm_intro" })
    expect(errorsOf(schema, { ...valid, region: "Ohio", first_contact_method: "email" })).toEqual({
      region: ORG_MESSAGES.region,
      first_contact_method: ORG_MESSAGES.firstContactMethod,
    })
  })

  it("checks dates and catches a mistyped year", () => {
    expect(errorsOf(schema, { ...valid, next_step_date: "2026-02-30" })).toEqual({
      next_step_date: ORG_MESSAGES.nextStepDate,
    })
    expect(errorsOf(schema, { ...valid, next_step_date: "2206-10-20" })).toEqual({
      next_step_date: ORG_MESSAGES.dateRange,
    })
    expect(errorsOf(schema, { ...valid, first_contact_date: "10/14/2026" })).toEqual({
      first_contact_date: ORG_MESSAGES.date,
    })
    expect(
      schema.parse({ ...valid, first_contact_date: "2026-10-07", last_contact_date: "2026-10-09" }),
    ).toMatchObject({ first_contact_date: "2026-10-07", last_contact_date: "2026-10-09" })
  })

  it("checks the owner and linked records are ids", () => {
    expect(
      errorsOf(schema, {
        ...valid,
        owner_id: "John",
        key_result_id: "Q1",
        related_organization_id: "nope",
      }),
    ).toEqual({
      owner_id: ORG_MESSAGES.owner,
      key_result_id: ORG_MESSAGES.keyResult,
      related_organization_id: messages.relatedOrg,
    })
    expect(
      schema.parse({ ...valid, key_result_id: KR, related_organization_id: OTHER_ORG }),
    ).toMatchObject({ key_result_id: KR, related_organization_id: OTHER_ORG })
  })
})

describe("orgUpdateSchemaFor", () => {
  const schema = orgUpdateSchemaFor("investor")

  it("needs the org's id and leaves a missing stage as it is", () => {
    expect(schema.parse({ ...valid, id: ORG })).toEqual({ ...valid, id: ORG })
    expect(errorsOf(schema, valid)).toEqual({ id: orgKindMessages("investor").org })
  })

  it("checks the stage against the kind", () => {
    expect(schema.parse({ ...valid, id: ORG, stage: "diligence" }).stage).toBe("diligence")
    expect(
      errorsOf(orgUpdateSchemaFor("customer"), { ...valid, id: ORG, stage: "diligence" }),
    ).toEqual({ stage: orgKindMessages("customer").stage })
  })

  it("clears blank optional fields with null", () => {
    const result = schema.parse({ ...valid, id: ORG, contact_name: "", notes: " ", region: "" })
    expect(result).toMatchObject({ contact_name: null, notes: null, region: null })
  })

  it("refuses an org related to itself", () => {
    expect(errorsOf(schema, { ...valid, id: ORG, related_organization_id: ORG })).toEqual({
      related_organization_id: orgKindMessages("investor").relatedOrg,
    })
  })
})

describe("orgCreateSchema (kind in the body)", () => {
  it("validates against the named kind", () => {
    expect(orgCreateSchema.parse({ ...valid, kind: "customer", stage: "pilot_active" })).toEqual({
      ...valid,
      kind: "customer",
      stage: "pilot_active",
    })
    expect(
      orgCreateSchema.safeParse({ ...valid, kind: "investor", stage: "pilot_active" }).success,
    ).toBe(false)
    expect(orgCreateSchema.safeParse({ ...valid, kind: "partner" }).success).toBe(false)
  })
})

describe("messages and helpers", () => {
  it("names the kind with the right article", () => {
    expect(orgKindMessages("investor").duplicate("Acme")).toBe(
      "There's already an investor called Acme.",
    )
    expect(orgKindMessages("customer").duplicate("Acme")).toBe(
      "There's already a customer called Acme.",
    )
    expect(orgKindMessages("investor").relatedOrg).toBe(
      "Choose a customer from the list, or leave it empty.",
    )
    expect(orgKindMessages("customer").relatedOrg).toBe(
      "Choose an investor from the list, or leave it empty.",
    )
  })

  it("finds the other kind", () => {
    expect(otherOrgKind("investor")).toBe("customer")
    expect(otherOrgKind("customer")).toBe("investor")
  })

  it.each([
    ["example.com", "https://example.com"],
    ["www.example.co.uk/about", "https://www.example.co.uk/about"],
    ["https://example.com", "https://example.com"],
    ["javascript:alert(1)", "javascript:alert(1)"],
    ["just words", "just words"],
    ["localhost", "localhost"],
    ["", ""],
  ])("withHttps(%j) = %j", (input, expected) => {
    expect(withHttps(input)).toBe(expected)
  })

  it("lists every editable column once", () => {
    expect(new Set(ORG_FORM_FIELDS).size).toBe(ORG_FORM_FIELDS.length)
  })
})
