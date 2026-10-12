import { describe, expect, it } from "vitest"
import type { OrgDetail, OrgFormOptions } from "../queries/detail"
import { editDefaults, editOptions } from "./edit-defaults"

const org: OrgDetail = {
  id: "o1",
  kind: "investor",
  name: "Example Seed Fund",
  stage: "meeting",
  stageLabel: "Meeting",
  stageOutcome: "open",
  subtype: "vc",
  owner: { id: "p9", name: "Former Mate", avatarUrl: null, role: "CFO", isActive: false },
  nextStep: "Send the deck",
  nextStepDate: "2026-10-20",
  contactName: "Jane Doe",
  contactTitle: null,
  contactEmail: "jane@example.com",
  contactPhone: null,
  link: null,
  city: "Akron",
  stateOrCountry: null,
  region: "ohio",
  firstContactDate: null,
  firstContactMethod: "warm_intro",
  introducedBy: null,
  checkSizeOrFocus: null,
  lastContactDate: "2026-10-09",
  manualLastContactDate: "2026-10-01",
  daysSinceContact: 3,
  isStale: false,
  followUpOverdue: false,
  latestMeetingAt: null,
  nextMeetingAt: null,
  notes: null,
  keyResult: {
    id: "kr9",
    title: "Book 10 meetings",
    objectiveTitle: "Raise",
    quarterLabel: "Q1",
    archived: true,
  },
  related: { id: "c9", name: "Acme", kind: "customer", archived: true },
  archivedAt: null,
  createdAt: "2026-10-01T12:00:00Z",
}

const options: OrgFormOptions = {
  people: [{ id: "p1", name: "John LaRocco" }],
  keyResults: [{ label: "Q1 · Raise", options: [{ value: "kr1", label: "Pitch 5 funds" }] }],
  relatedOrgs: [{ value: "c1", label: "Builder Co" }],
}

describe("editDefaults", () => {
  it("fills every field with the stored value, or empty", () => {
    expect(editDefaults(org)).toMatchObject({
      name: "Example Seed Fund",
      subtype: "vc",
      stage: "meeting",
      owner_id: "p9",
      contact_title: "",
      region: "ohio",
      first_contact_method: "warm_intro",
      // The hand-entered date, not the derived one.
      last_contact_date: "2026-10-01",
      key_result_id: "kr9",
      related_organization_id: "c9",
    })
  })
})

describe("editOptions", () => {
  it("keeps what the org points at selectable", () => {
    const result = editOptions(options, org)
    expect(result.people).toContainEqual({ id: "p9", name: "Former Mate (no longer on the team)" })
    expect(result.keyResults.at(-1)).toEqual({
      label: "Linked now",
      options: [{ value: "kr9", label: "Q1 · Book 10 meetings (archived)" }],
    })
    expect(result.relatedOrgs).toContainEqual({ value: "c9", label: "Acme (archived)" })
  })

  it("adds nothing when the lists already have them", () => {
    const current = {
      ...org,
      owner: { ...org.owner, id: "p1", isActive: true },
      keyResult: null,
      related: { id: "c1", name: "Builder Co", kind: "customer" as const, archived: false },
    }
    expect(editOptions(options, current)).toEqual(options)
  })
})
