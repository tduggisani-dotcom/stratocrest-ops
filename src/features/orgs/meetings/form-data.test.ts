import { describe, expect, test } from "vitest"
import {
  NEXT_STEP_DATE_ORIGINAL,
  NEXT_STEP_ORIGINAL,
  meetingFieldErrors,
  meetingFormValues,
  readMeetingForm,
} from "./form-data"

function formData(entries: [string, string][]): FormData {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const base: [string, string][] = [
  ["organization_id", "org-1"],
  ["meeting_date", "2026-10-12"],
  ["meeting_time", "10:00"],
  ["attendee_ids", "me"],
  ["attendee_ids", "mate"],
  ["rating", "4"],
  ["summary", "Good"],
  [NEXT_STEP_ORIGINAL, "Send the deck"],
  [NEXT_STEP_DATE_ORIGINAL, "2026-10-20"],
]

describe("readMeetingForm", () => {
  test("reads every ticked attendee and the org (create) or meeting id (edit)", () => {
    const created = readMeetingForm(
      formData([...base, ["next_step", "Send the deck"], ["next_step_date", "2026-10-20"]]),
      "create",
    )
    expect(created).toMatchObject({
      organization_id: "org-1",
      meeting_date: "2026-10-12",
      attendee_ids: ["me", "mate"],
      rating: "4",
    })
    expect(created).not.toHaveProperty("id")

    const edited = readMeetingForm(formData([...base, ["id", "meeting-1"]]), "edit")
    expect(edited).toMatchObject({ id: "meeting-1" })
    expect(edited).not.toHaveProperty("organization_id")
  })

  test("no ticked attendees reads as an empty list", () => {
    expect(
      readMeetingForm(formData([["meeting_date", "2026-10-12"]]), "create").attendee_ids,
    ).toEqual([])
  })

  test("sends the org's next step only when the form changed it", () => {
    const same = readMeetingForm(
      formData([...base, ["next_step", " Send the deck "], ["next_step_date", "2026-10-20"]]),
      "create",
    )
    expect(same).not.toHaveProperty("next_step")
    expect(same).not.toHaveProperty("next_step_date")

    const newStep = readMeetingForm(
      formData([...base, ["next_step", "Book a demo"], ["next_step_date", "2026-10-20"]]),
      "create",
    )
    expect(newStep).toMatchObject({ next_step: "Book a demo", next_step_date: "2026-10-20" })

    const newDate = readMeetingForm(
      formData([...base, ["next_step", "Send the deck"], ["next_step_date", "2026-10-22"]]),
      "create",
    )
    expect(newDate).toMatchObject({ next_step: "Send the deck", next_step_date: "2026-10-22" })

    // Clearing it is a change (the schema then asks for a next step).
    const cleared = readMeetingForm(
      formData([...base, ["next_step", ""], ["next_step_date", "2026-10-20"]]),
      "create",
    )
    expect(cleared).toMatchObject({ next_step: "", next_step_date: "2026-10-20" })
  })
})

describe("meetingFormValues", () => {
  test("keeps what was typed, with the ticked attendees comma-joined", () => {
    const values = meetingFormValues(formData(base))
    expect(values).toMatchObject({
      meeting_date: "2026-10-12",
      attendee_ids: "me,mate",
      rating: "4",
    })
  })
})

describe("meetingFieldErrors", () => {
  test("files an error on one attendee under the attendee field", () => {
    expect(
      meetingFieldErrors({ "attendee_ids.1": "Pick again", summary: "One line", rating: "x" }),
    ).toEqual({ attendee_ids: "Pick again", summary: "One line", rating: "x" })
  })
})
