import { describe, expect, test } from "vitest"
import { fieldErrorsFrom } from "@/lib/forms"
import {
  ORG_MEETING_LIMITS,
  ORG_MEETING_MESSAGES,
  orgMeetingCreateSchema,
  orgMeetingUpdateSchema,
} from "./org-meetings"

const ORG = "6f1c3c2e-8f0a-4c55-9c4b-3a2a7f0e9d11"
const ME = "f294266f-162f-43dc-a6d6-81aa7192d182"
const MATE = "a0155707-2801-4897-9bd2-773243e7fc50"
const MEETING = "0b7d8a51-0f39-4a36-9a3d-1f0f1c2b9e44"

/** 2026-10-12 15:00 ET (EDT, UTC-4). */
const NOW = new Date("2026-10-12T19:00:00.000Z")
const create = orgMeetingCreateSchema(() => NOW)
const edit = orgMeetingUpdateSchema(() => NOW)

/** What the form sends for a meeting earlier today, with only the required fields. */
function form(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: ORG,
    meeting_date: "2026-10-12",
    meeting_time: "10:00",
    attendee_ids: [ME],
    external_attendees: "",
    rating: "",
    summary: "",
    notes: "",
    concerns_raised: "",
    materials_requested: "",
    follow_up_owner_id: "",
    follow_up_date: "",
    ...overrides,
  }
}

function errors(input: unknown, schema: typeof create | typeof edit = create) {
  const result = schema.safeParse(input)
  return result.success ? {} : fieldErrorsFrom(result.error)
}

describe("orgMeetingCreateSchema", () => {
  test("turns the ET date and time into starts_at, and blanks into nulls", () => {
    expect(create.parse(form())).toEqual({
      organization_id: ORG,
      starts_at: "2026-10-12T14:00:00.000Z",
      attendee_ids: [ME],
      external_attendees: null,
      rating: null,
      summary: null,
      notes: null,
      concerns_raised: null,
      materials_requested: null,
      follow_up_owner_id: null,
      follow_up_date: null,
    })
  })

  test("uses the ET offset of the meeting's own day (EST after November 1)", () => {
    const later = orgMeetingCreateSchema(() => new Date("2026-12-01T00:00:00Z"))
    expect(later.parse(form({ meeting_date: "2026-11-10", meeting_time: "09:30" })).starts_at).toBe(
      "2026-11-10T14:30:00.000Z",
    )
  })

  test("keeps every field, trimmed, with a rating as a number", () => {
    const parsed = create.parse(
      form({
        attendee_ids: [ME, MATE, ME],
        external_attendees: " Jane Doe, partner ",
        rating: "4",
        summary: " Keen on the pilot data ",
        notes: "Demoed the helmet.",
        concerns_raised: "Battery life",
        materials_requested: "Deck",
        follow_up_owner_id: MATE,
        follow_up_date: "2026-10-16",
        next_step: " Send the test results ",
        next_step_date: "2026-10-16",
      }),
    )
    expect(parsed).toMatchObject({
      attendee_ids: [ME, MATE],
      external_attendees: "Jane Doe, partner",
      rating: 4,
      summary: "Keen on the pilot data",
      follow_up_owner_id: MATE,
      follow_up_date: "2026-10-16",
      next_step: "Send the test results",
      next_step_date: "2026-10-16",
    })
  })

  test("accepts one attendee as a plain id, and the API's numeric rating", () => {
    const parsed = create.parse(form({ attendee_ids: ME, rating: 5, summary: "Great" }))
    expect(parsed.attendee_ids).toEqual([ME])
    expect(parsed.rating).toBe(5)
  })

  test("needs a date, a time and at least one of us", () => {
    expect(errors(form({ meeting_date: "", meeting_time: "", attendee_ids: [] }))).toEqual({
      meeting_date: ORG_MEETING_MESSAGES.date,
      meeting_time: ORG_MEETING_MESSAGES.time,
      attendee_ids: ORG_MEETING_MESSAGES.attendees,
    })
    expect(errors(form({ attendee_ids: undefined })).attendee_ids).toBe(
      ORG_MEETING_MESSAGES.attendees,
    )
    expect(errors(form({ attendee_ids: ["not-an-id"] }))["attendee_ids.0"]).toBe(
      ORG_MEETING_MESSAGES.attendees,
    )
    expect(errors(form({ meeting_date: "2026-02-30" })).meeting_date).toBe(
      ORG_MEETING_MESSAGES.date,
    )
    expect(errors(form({ meeting_date: "1999-10-12" })).meeting_date).toBe(
      ORG_MEETING_MESSAGES.dateRange,
    )
    expect(errors(form({ meeting_time: "25:00" })).meeting_time).toBe(ORG_MEETING_MESSAGES.time)
  })

  test("drops seconds from the time", () => {
    expect(create.parse(form({ meeting_time: "10:00:30" })).starts_at).toBe(
      "2026-10-12T14:00:00.000Z",
    )
  })

  test("a rating is 1 to 5, needs a one-line summary, and only once the meeting has happened", () => {
    expect(errors(form({ rating: "6", summary: "x" })).rating).toBe(ORG_MEETING_MESSAGES.rating)
    expect(errors(form({ rating: "0", summary: "x" })).rating).toBe(ORG_MEETING_MESSAGES.rating)
    expect(errors(form({ rating: "four", summary: "x" })).rating).toBe(ORG_MEETING_MESSAGES.rating)
    expect(errors(form({ rating: "3" })).summary).toBe(ORG_MEETING_MESSAGES.summary)

    // 15:30 ET today is after NOW (15:00 ET): not yet.
    expect(errors(form({ meeting_time: "15:30", rating: "4", summary: "Good" }))).toEqual({
      rating: ORG_MEETING_MESSAGES.futureRating,
    })
    // Exactly now is fine.
    expect(errors(form({ meeting_time: "15:00", rating: "4", summary: "Good" }))).toEqual({})
  })

  test("a future meeting can be logged without a rating (scheduled)", () => {
    const parsed = create.parse(form({ meeting_date: "2026-10-20", summary: "Intro call" }))
    expect(parsed).toMatchObject({ rating: null, summary: "Intro call" })
  })

  test("follow-up owner and date: both or neither", () => {
    expect(errors(form({ follow_up_owner_id: ME }))).toEqual({
      follow_up_date: ORG_MEETING_MESSAGES.followUp,
    })
    expect(errors(form({ follow_up_date: "2026-10-20" }))).toEqual({
      follow_up_owner_id: ORG_MEETING_MESSAGES.followUp,
    })
    expect(errors(form({ follow_up_owner_id: "nobody", follow_up_date: "2026-10-20" }))).toEqual({
      follow_up_owner_id: ORG_MEETING_MESSAGES.followUp,
    })
  })

  test("a new next step needs both the step and its date; leaving both out keeps the org's", () => {
    expect(create.parse(form())).not.toHaveProperty("next_step")
    expect(errors(form({ next_step: "Call back" }))).toEqual({
      next_step_date: ORG_MEETING_MESSAGES.nextStepDate,
    })
    expect(errors(form({ next_step_date: "2026-10-20" }))).toEqual({
      next_step: ORG_MEETING_MESSAGES.nextStep,
    })
    expect(errors(form({ next_step: "  ", next_step_date: "2026-10-20" }))).toEqual({
      next_step: ORG_MEETING_MESSAGES.nextStep,
    })
    expect(errors(form({ next_step: "Call back", next_step_date: "" }))).toEqual({
      next_step_date: ORG_MEETING_MESSAGES.nextStepDate,
    })
  })

  test("text limits mirror the database", () => {
    const at = (field: keyof typeof ORG_MEETING_LIMITS, extra: number) =>
      errors(form({ [field]: "x".repeat(ORG_MEETING_LIMITS[field] + extra) }))[field]
    for (const field of Object.keys(ORG_MEETING_LIMITS) as (keyof typeof ORG_MEETING_LIMITS)[]) {
      expect(at(field, 0), field).toBeUndefined()
      expect(at(field, 1), field).toMatch(/characters or fewer/)
    }
    expect(
      errors(form({ next_step: "x".repeat(501), next_step_date: "2026-10-20" })).next_step,
    ).toMatch(/500 characters or fewer/)
  })

  test("needs the org it belongs to", () => {
    expect(errors(form({ organization_id: "" })).organization_id).toBe(ORG_MEETING_MESSAGES.org)
  })
})

describe("orgMeetingUpdateSchema", () => {
  test("takes the meeting's id instead of the org's", () => {
    const { organization_id: _org, ...rest } = form()
    expect(edit.parse({ ...rest, id: MEETING })).toMatchObject({
      id: MEETING,
      starts_at: "2026-10-12T14:00:00.000Z",
    })
    expect(errors({ ...rest, id: "nope" }, edit).id).toBe(ORG_MEETING_MESSAGES.meeting)
  })

  test("applies the same rules", () => {
    const { organization_id: _org, ...rest } = form()
    expect(
      errors({ ...rest, id: MEETING, meeting_date: "2026-10-13", rating: "5", summary: "x" }, edit),
    ).toEqual({ rating: ORG_MEETING_MESSAGES.futureRating })
  })
})
