import type { Route } from "next"
import type { FormState } from "@/lib/forms"

/**
 * Shapes the task Server Actions return. Kept out of actions.ts because a
 * "use server" file may only export async functions.
 */

/** The task form's state. On success, `redirectTo` is where a new task's form goes next. */
export type TaskFormState = FormState & { redirectTo?: Route }

export const initialTaskFormState: TaskFormState = { status: "idle" }

/** Status changes, archive and restore: called from buttons, not forms. */
export type TaskActionResult = { status: "success" } | { status: "error"; message: string }
