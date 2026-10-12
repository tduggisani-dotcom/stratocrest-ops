"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom, formValues } from "@/lib/forms"
import {
  DEBRIEF_ANSWER_FIELDS,
  DEBRIEF_MESSAGES,
  debriefUpdateSchema,
} from "@/lib/schemas/debriefs"
import { createClient } from "@/lib/supabase/server"
import { readDebriefForm } from "./form-data"
import type { DebriefFormState } from "./types"

/**
 * Debrief Server Actions (spec §6.7). Each is a public endpoint: it checks the
 * session, validates with the shared Zod schema, and writes as the signed-in
 * person (RLS applies; triggers fill completed_at, updated_by and the history).
 */

const CHECK_FIELDS = "Check the highlighted fields."

/**
 * The debrief form: saves the answers and facilitator. "Save" keeps the
 * status (a partly written debrief stays due), "Save and mark done" marks it
 * done (at least one answer needed), "Reopen" makes it due again.
 */
export async function updateDebrief(
  _prev: DebriefFormState,
  formData: FormData,
): Promise<DebriefFormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = debriefUpdateSchema.safeParse(readDebriefForm(formData))
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error)
    return {
      status: "error",
      message:
        fieldErrors.id ??
        fieldErrors.status ??
        (fieldErrors.planned === DEBRIEF_MESSAGES.emptyDone
          ? DEBRIEF_MESSAGES.emptyDone
          : CHECK_FIELDS),
      fieldErrors,
      values,
    }
  }

  const { id, ...changes } = parsed.data
  const supabase = await createClient()

  // Marking done: answers this request didn't send count as they're stored.
  if (changes.status === "done" && DEBRIEF_ANSWER_FIELDS.some((f) => changes[f] === undefined)) {
    const { data: stored, error } = await supabase
      .from("debriefs")
      .select("planned, actual, worked, change")
      .eq("id", id)
      .maybeSingle()
    if (error) {
      console.error("Reading a debrief failed", { code: error.code })
      return { status: "error", message: friendlyDbError(error), values }
    }
    if (!stored) return { status: "error", message: DEBRIEF_MESSAGES.debrief, values }
    const answered = DEBRIEF_ANSWER_FIELDS.some((f) => (changes[f] ?? stored[f]) !== null)
    if (!answered) {
      return {
        status: "error",
        message: DEBRIEF_MESSAGES.emptyDone,
        fieldErrors: { planned: DEBRIEF_MESSAGES.emptyDone },
        values,
      }
    }
  }

  const { data, error } = await supabase
    .from("debriefs")
    .update(changes)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    console.error("Saving a debrief failed", { code: error.code })
    return {
      status: "error",
      message: friendlyDbError(error, "Couldn't save the debrief."),
      values,
    }
  }
  if (!data) return { status: "error", message: DEBRIEF_MESSAGES.debrief, values }

  refresh()
  return {
    status: "success",
    id,
    message:
      changes.status === "done"
        ? "Debrief marked done"
        : changes.status === "due"
          ? "Debrief reopened"
          : "Debrief saved",
  }
}
