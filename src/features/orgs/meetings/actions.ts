"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom } from "@/lib/forms"
import {
  ORG_MEETING_MESSAGES,
  orgMeetingCreateSchema,
  orgMeetingIdSchema,
  orgMeetingUpdateSchema,
  type OrgMeetingCreate,
} from "@/lib/schemas/org-meetings"
import { taskInputSchema } from "@/lib/schemas/tasks"
import { createClient } from "@/lib/supabase/server"
import { meetingHref } from "../links"
import { meetingFieldErrors, meetingFormValues, readMeetingForm } from "./form-data"
import { FOLLOW_UP_TITLE_PREFIX, followUpTaskDraft } from "./helpers"
import type { FollowUpResult, MeetingFormState } from "./types"

/**
 * Org meeting Server Actions. Each one is a public endpoint: it checks the
 * session, validates with the shared Zod schema, and writes as the signed-in
 * person (RLS applies). Logging and editing go through one database function
 * each (public.log_org_meeting / update_org_meeting), so the meeting, who went
 * and the org's next step are saved together or not at all, and are one change
 * in the history. The database opens the debrief once the meeting has happened.
 */

const CHECK_FIELDS = "Check the highlighted fields."

/** null -> left out of the call (the database function's default: none). */
function orNone<T>(value: T | null): T | undefined {
  return value ?? undefined
}

/** The database function's arguments: empty optional fields are left out (= none). */
function rpcFields(meeting: Omit<OrgMeetingCreate, "organization_id">) {
  return {
    p_starts_at: meeting.starts_at,
    p_attendee_ids: meeting.attendee_ids,
    p_external_attendees: orNone(meeting.external_attendees),
    p_rating: orNone(meeting.rating),
    p_summary: orNone(meeting.summary),
    p_notes: orNone(meeting.notes),
    p_concerns_raised: orNone(meeting.concerns_raised),
    p_materials_requested: orNone(meeting.materials_requested),
    p_follow_up_owner_id: orNone(meeting.follow_up_owner_id),
    p_follow_up_date: orNone(meeting.follow_up_date),
    p_next_step: meeting.next_step,
    p_next_step_date: meeting.next_step_date,
  }
}

/** A failed parse as the form's state: the id fields become a message for the whole form. */
function invalid(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): MeetingFormState {
  const errors = meetingFieldErrors(fieldErrors)
  const gone =
    fieldErrors.organization_id ?? (fieldErrors.id ? ORG_MEETING_MESSAGES.meeting : undefined)
  return { status: "error", message: gone ?? CHECK_FIELDS, fieldErrors: errors, values }
}

/**
 * Screen 1: log a meeting. On success the form goes to screen 2, the meeting's
 * page with "Meeting logged" (debrief and one-click follow-up task).
 */
export async function logOrgMeeting(
  _prev: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  await requireTeamMember()
  const values = meetingFormValues(formData)
  const parsed = orgMeetingCreateSchema().safeParse(readMeetingForm(formData, "create"))
  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), values)

  const { organization_id: orgId, ...meeting } = parsed.data
  const supabase = await createClient()
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("kind")
    .eq("id", orgId)
    .maybeSingle()
  if (orgError) {
    console.error("Reading an org before logging a meeting failed", { code: orgError.code })
    return { status: "error", message: friendlyDbError(orgError), values }
  }
  if (!org) return { status: "error", message: ORG_MEETING_MESSAGES.org, values }

  const { data: meetingId, error } = await supabase.rpc("log_org_meeting", {
    p_organization_id: orgId,
    ...rpcFields(meeting),
  })
  if (error || !meetingId) {
    console.error("Logging a meeting failed", { code: error?.code })
    return {
      status: "error",
      message: friendlyDbError(error, "Couldn't log the meeting. Please try again."),
      values,
    }
  }

  refresh()
  return {
    status: "success",
    id: meetingId,
    redirectTo: meetingHref(org.kind, orgId, meetingId, { logged: true }),
  }
}

/** The meeting page's Edit form: replaces every field and who went (one change). */
export async function updateOrgMeeting(
  _prev: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  await requireTeamMember()
  const values = meetingFormValues(formData)
  const parsed = orgMeetingUpdateSchema().safeParse(readMeetingForm(formData, "edit"))
  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), values)

  const { id, ...meeting } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc("update_org_meeting", {
    p_meeting_id: id,
    ...rpcFields(meeting),
  })
  if (error) {
    console.error("Saving a meeting failed", { code: error.code })
    return {
      status: "error",
      message:
        error.code === "P0002"
          ? ORG_MEETING_MESSAGES.meeting
          : friendlyDbError(error, "Couldn't save the meeting. Please try again."),
      values,
    }
  }

  refresh()
  return { status: "success", id, message: "Meeting saved" }
}

/**
 * Screen 2's "Add follow-up task": one click creates "Follow up with <org>",
 * with the org's next step as the next action, owned by the meeting's
 * follow-up owner (else the org's owner) and due on the follow-up date (else
 * the next step's date), linked to the org and the meeting. A second click (or
 * a teammate's) finds the open one instead of adding another.
 */
export async function addFollowUpTask(meetingId: string): Promise<FollowUpResult> {
  await requireTeamMember()
  const parsed = orgMeetingIdSchema.safeParse(meetingId)
  if (!parsed.success) return { status: "error", message: ORG_MEETING_MESSAGES.meeting }

  const supabase = await createClient()
  const { data: meeting, error } = await supabase
    .from("org_meetings")
    .select(
      `id, starts_at, follow_up_owner_id, follow_up_date, materials_requested, concerns_raised,
       organization:organizations!org_meetings_organization_id_fkey (
         id, name, owner_id, next_step, next_step_date, archived_at
       )`,
    )
    .eq("id", parsed.data)
    .maybeSingle()
  if (error) {
    console.error("Reading a meeting for its follow-up failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error, "Couldn't add the task.") }
  }
  if (!meeting) return { status: "error", message: ORG_MEETING_MESSAGES.meeting }

  // No duplicates: an open follow-up task for this meeting is the one.
  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("org_meeting_id", meeting.id)
    .like("title", `${FOLLOW_UP_TITLE_PREFIX}%`)
    .is("archived_at", null)
    .neq("status", "done")
    .order("created_at")
    .limit(1)
    .maybeSingle()
  if (existingError) {
    console.error("Looking for a follow-up task failed", { code: existingError.code })
    return { status: "error", message: friendlyDbError(existingError, "Couldn't add the task.") }
  }
  if (existing) return { status: "success", taskId: existing.id, created: false }

  const org = meeting.organization
  const task = taskInputSchema.safeParse(
    followUpTaskDraft({
      org: {
        id: org.id,
        name: org.name,
        ownerId: org.owner_id,
        nextStep: org.next_step,
        nextStepDate: org.next_step_date,
      },
      meeting: {
        id: meeting.id,
        startsAt: meeting.starts_at,
        followUpOwnerId: meeting.follow_up_owner_id,
        followUpDate: meeting.follow_up_date,
        materialsRequested: meeting.materials_requested,
        concernsRaised: meeting.concerns_raised,
      },
    }),
  )
  if (!task.success) {
    return {
      status: "error",
      message: task.error.issues[0]?.message ?? "Couldn't add the task.",
    }
  }

  const { data: created, error: insertError } = await supabase
    .from("tasks")
    .insert(task.data)
    .select("id")
    .single()
  if (insertError) {
    console.error("Adding a follow-up task failed", { code: insertError.code })
    return { status: "error", message: friendlyDbError(insertError, "Couldn't add the task.") }
  }

  refresh()
  return { status: "success", taskId: created.id, created: true }
}
