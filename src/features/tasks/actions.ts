"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { crunchWarning } from "@/lib/crunch"
import { formatDate } from "@/lib/dates"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom, formValues } from "@/lib/forms"
import {
  TASK_MESSAGES,
  taskIdSchema,
  taskInputSchema,
  taskStatusUpdateSchema,
  taskUpdateSchema,
  type TaskInput,
  type TaskStatus,
} from "@/lib/schemas/tasks"
import { createClient } from "@/lib/supabase/server"
import { readTaskForm } from "./form-data"
import { taskReturnPath } from "./links"
import type { TaskActionResult, TaskFormState, TaskStatusResult } from "./types"
import { UNDO_NOT_POSSIBLE, undoErrorMessage } from "./undo-messages"

/**
 * Task Server Actions. Each one is a public endpoint: it checks the session,
 * validates with the shared Zod schema, and writes as the signed-in person
 * (RLS applies; triggers fill created_by, updated_by and completed_at).
 */

const CHECK_FIELDS = "Check the highlighted fields."
const GONE = "This task was archived or no longer exists. Refresh to see the latest."

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** New task form. On success the client shows "Task added" and goes to `redirectTo`. */
export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = taskInputSchema.safeParse(readTaskForm(formData, "create"))
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from("tasks").insert(parsed.data).select("id").single()
  if (error) {
    console.error("Adding a task failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error, "Couldn't add the task."), values }
  }

  const warnings = await crunchWarnings(supabase, parsed.data)
  refresh()
  return {
    status: "success",
    id: data.id,
    warnings,
    redirectTo: taskReturnPath(formData.get("return_to")),
  }
}

/** Task page edit form: replaces every editable field. Archived tasks can't be edited. */
export async function updateTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = taskUpdateSchema.safeParse(readTaskForm(formData, "update"))
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error)
    return {
      status: "error",
      message: fieldErrors.id ? TASK_MESSAGES.task : CHECK_FIELDS,
      fieldErrors,
      values,
    }
  }

  const { id, ...changes } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update(changes)
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()
  if (error) {
    console.error("Saving a task failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error), values }
  }
  if (!data) return { status: "error", message: GONE, values }

  const warnings = await crunchWarnings(supabase, parsed.data)
  refresh()
  return { status: "success", id, warnings }
}

/**
 * The inline status control (lists and the task page). Returns the
 * activity_log entry of the change, so the toast's Undo can reverse exactly
 * that change (undoTaskChange) instead of writing a new status.
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<TaskStatusResult> {
  const person = await requireTeamMember()
  const parsed = taskStatusUpdateSchema.safeParse({ id, status })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? TASK_MESSAGES.status }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .is("archived_at", null)
    .select("id, updated_at")
    .maybeSingle()
  if (error) {
    console.error("Changing a task's status failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error, "Couldn't change the status.") }
  }
  if (!data) return { status: "error", message: GONE }

  const undoId = await changeLogId(supabase, data.id, person.id, data.updated_at)
  refresh()
  return { status: "success", undoId }
}

/**
 * The toast's Undo after an inline status change: reverses that change with
 * public.undo_activity. Unlike setting the old status again, this keeps a
 * reopened task's original completion time and leaves no win behind for an
 * accidental "done". It refuses when the task has changed since.
 */
export async function undoTaskChange(logId: number): Promise<TaskActionResult> {
  await requireTeamMember()
  if (!Number.isSafeInteger(logId) || logId <= 0) {
    return { status: "error", message: UNDO_NOT_POSSIBLE }
  }

  const supabase = await createClient()
  // Only task changes are undone from here.
  const { data: entry, error: readError } = await supabase
    .from("activity_log")
    .select("entity_type")
    .eq("id", logId)
    .maybeSingle()
  if (readError) {
    console.error("Reading a task change failed", { code: readError.code })
    return { status: "error", message: undoErrorMessage(readError) }
  }
  if (entry?.entity_type !== "tasks") return { status: "error", message: UNDO_NOT_POSSIBLE }

  const { error } = await supabase.rpc("undo_activity", { p_log_id: logId })
  if (error) {
    console.error("Undoing a task change failed", { code: error.code })
    return { status: "error", message: undoErrorMessage(error) }
  }

  refresh()
  return { status: "success" }
}

/** Archive (tasks are never deleted). Restore with restoreTask. */
export async function archiveTask(id: string): Promise<TaskActionResult> {
  return setArchived(id, true)
}

/** Brings an archived task back (the "Undo" after archiving, and the task page's Restore). */
export async function restoreTask(id: string): Promise<TaskActionResult> {
  return setArchived(id, false)
}

async function setArchived(id: string, archive: boolean): Promise<TaskActionResult> {
  await requireTeamMember()
  const parsed = taskIdSchema.safeParse(id)
  if (!parsed.success) return { status: "error", message: TASK_MESSAGES.task }

  const supabase = await createClient()
  const update = supabase
    .from("tasks")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", parsed.data)
  const { data, error } = await (
    archive ? update.is("archived_at", null) : update.not("archived_at", "is", null)
  )
    .select("id")
    .maybeSingle()
  if (error) {
    console.error(archive ? "Archiving a task failed" : "Restoring a task failed", {
      code: error.code,
    })
    return { status: "error", message: friendlyDbError(error) }
  }
  if (!data) {
    return {
      status: "error",
      message: archive
        ? "This task is already archived. Refresh to see the latest."
        : "This task isn't archived any more. Refresh to see the latest.",
    }
  }

  refresh()
  return { status: "success" }
}

/**
 * The activity_log entry that an update of this task by this person just
 * wrote. The audit trigger stamps occurred_at with the same now() as the row's
 * updated_at, so matching on it finds this change and no other. Null when
 * nothing was logged (no field really changed) or the lookup failed.
 */
async function changeLogId(
  supabase: ServerClient,
  taskId: string,
  actorId: string,
  updatedAt: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "tasks")
    .eq("entity_id", taskId)
    .eq("actor_id", actorId)
    .eq("occurred_at", updatedAt)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error("Finding a task change for Undo failed", { code: error.code })
    return null
  }
  return data?.id ?? null
}

/**
 * "The due date falls in Sam's crunch period: Finals (Dec 7 – Dec 18)." for each
 * of the owner's crunch periods that include the due date. A warning, never a
 * block (spec §6.4); a failed lookup just means no warning.
 */
async function crunchWarnings(
  supabase: ServerClient,
  task: Pick<TaskInput, "owner_id" | "due_date" | "status">,
): Promise<string[]> {
  if (task.status === "done") return []
  const [periods, owner] = await Promise.all([
    supabase
      .from("crunch_periods")
      .select("person_id, label, start_date, end_date")
      .eq("person_id", task.owner_id)
      .lte("start_date", task.due_date)
      .gte("end_date", task.due_date)
      .order("start_date"),
    supabase.from("people").select("name").eq("id", task.owner_id).maybeSingle(),
  ])
  if (periods.error || owner.error || !owner.data) {
    console.error("Checking crunch periods failed", {
      code: periods.error?.code ?? owner.error?.code,
    })
    return []
  }
  const ownerName = owner.data.name
  return periods.data.map((p) =>
    crunchWarning(
      ownerName,
      { personId: p.person_id, label: p.label, startDate: p.start_date, endDate: p.end_date },
      (day) => formatDate(day, "short"),
    ),
  )
}
