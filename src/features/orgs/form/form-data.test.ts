import { describe, expect, it } from "vitest"
import { orgInputSchemaFor, orgUpdateSchemaFor } from "@/lib/schemas/organizations"
import { readOrgForm } from "./form-data"

const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const filled = {
  name: " Example Seed Fund ",
  subtype: "",
  owner_id: OWNER,
  next_step: "Send the deck",
  next_step_date: "2026-10-20",
  contact_name: "",
  city: "Akron",
  region: "",
  notes: "  ",
}

describe("readOrgForm", () => {
  it("leaves emptied optional fields out of a create", () => {
    const input = readOrgForm(form(filled), "create")
    expect(input).toEqual({
      name: "Example Seed Fund",
      subtype: undefined,
      owner_id: OWNER,
      next_step: "Send the deck",
      next_step_date: "2026-10-20",
      contact_name: undefined,
      city: "Akron",
      region: undefined,
      notes: undefined,
    })
    expect(orgInputSchemaFor("investor").parse(input)).toMatchObject({
      name: "Example Seed Fund",
      stage: "identified",
      city: "Akron",
    })
  })

  it("clears emptied optional fields on an edit, and leaves unsent ones alone", () => {
    const input = readOrgForm(form({ ...filled, id: ORG, stage: "meeting" }), "update")
    expect(input).toMatchObject({ id: ORG, stage: "meeting", subtype: null, notes: null })
    expect(input).not.toHaveProperty("link")
    const parsed = orgUpdateSchemaFor("investor").parse(input)
    expect(parsed).toMatchObject({ contact_name: null, region: null, city: "Akron" })
    expect(parsed).not.toHaveProperty("link")
  })

  it("keeps an emptied required field missing, so the schema explains it", () => {
    const input = readOrgForm(form({ ...filled, id: ORG, next_step: " " }), "update")
    expect(input.next_step).toBeUndefined()
    expect(orgUpdateSchemaFor("investor").safeParse(input).success).toBe(false)
  })
})
