import type { Route } from "next"
import type { FormState } from "@/lib/forms"

/**
 * Shapes the meeting Server Actions return. Kept out of actions.ts because a
 * "use server" file may only export async functions.
 */

/** The meeting form's state. After logging, `redirectTo` is screen 2 (the meeting page). */
export type MeetingFormState = FormState & { redirectTo?: Route }

export const initialMeetingFormState: MeetingFormState = { status: "idle" }

/**
 * "Add follow-up task": the task's id, and whether this click created it (false
 * when the meeting already had an open follow-up task, so nothing was added).
 */
export type FollowUpResult =
  { status: "success"; taskId: string; created: boolean } | { status: "error"; message: string }
