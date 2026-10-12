import { formValues } from "@/lib/forms"
import type { OrgMeetingFormField } from "@/lib/schemas/org-meetings"

/**
 * From the meeting form's FormData to what the org-meetings schema reads
 * (unit-tested in form-data.test.ts).
 */

/** Hidden fields holding the org's next step as the form showed it. */
export const NEXT_STEP_ORIGINAL = "next_step_original"
export const NEXT_STEP_DATE_ORIGINAL = "next_step_date_original"

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name)
  return typeof value === "string" ? value : undefined
}

/**
 * The schema's input. Our attendees are every ticked `attendee_ids` box. The
 * org's next step is sent only when it was changed in the form, so a meeting
 * saved from an old page doesn't overwrite a next step someone changed since.
 */
export function readMeetingForm(
  formData: FormData,
  mode: "create" | "edit",
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    meeting_date: text(formData, "meeting_date"),
    meeting_time: text(formData, "meeting_time"),
    attendee_ids: formData.getAll("attendee_ids").filter((v) => typeof v === "string"),
    external_attendees: text(formData, "external_attendees"),
    rating: text(formData, "rating"),
    summary: text(formData, "summary"),
    notes: text(formData, "notes"),
    concerns_raised: text(formData, "concerns_raised"),
    materials_requested: text(formData, "materials_requested"),
    follow_up_owner_id: text(formData, "follow_up_owner_id"),
    follow_up_date: text(formData, "follow_up_date"),
  }
  if (mode === "create") input.organization_id = text(formData, "organization_id")
  else input.id = text(formData, "id")

  const step = text(formData, "next_step")
  const date = text(formData, "next_step_date")
  if (step !== undefined || date !== undefined) {
    const changed =
      (step ?? "").trim() !== (text(formData, NEXT_STEP_ORIGINAL) ?? "").trim() ||
      (date ?? "").trim() !== (text(formData, NEXT_STEP_DATE_ORIGINAL) ?? "").trim()
    if (changed) {
      input.next_step = step ?? ""
      input.next_step_date = date ?? ""
    }
  }
  return input
}

/** What was submitted, to refill the form after an error (ticked attendees comma-joined). */
export function meetingFormValues(formData: FormData): Record<string, string> {
  return {
    ...formValues(formData),
    attendee_ids: formData
      .getAll("attendee_ids")
      .filter((v) => typeof v === "string")
      .join(","),
  }
}

/**
 * Field errors keyed by the form's field names: "attendee_ids.1" (one bad id)
 * becomes "attendee_ids".
 */
export function meetingFieldErrors(
  errors: Record<string, string>,
): Partial<Record<OrgMeetingFormField | "_form", string>> {
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    const field = key.split(".")[0] ?? key
    out[field] ??= message
  }
  return out
}
