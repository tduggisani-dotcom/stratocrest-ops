import type { Route } from "next"
import type { FormState } from "@/lib/forms"

/**
 * Shapes the task Server Actions return. Kept out of actions.ts because a
 * "use server" file may only export async functions.
 */

/** The task form's state. On success, `redirectTo` is where a new task's form goes next. */
export type TaskFormState = FormState & { redirectTo?: Route }

export const initialTaskFormState: TaskFormState = { status: "idle" }

/** Archive, restore and undo: called from buttons, not forms. */
export type TaskActionResult = { status: "success" } | { status: "error"; message: string }

/**
 * An inline status change. `undoId` is the activity_log entry it wrote, which
 * the toast's Undo reverses; null when nothing was logged (the task already had
 * that status) or the lookup failed, and then the toast offers no Undo.
 */
export type TaskStatusResult =
  { status: "success"; undoId: number | null } | { status: "error"; message: string }
