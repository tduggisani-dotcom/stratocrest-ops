import { friendlyDbError } from "@/lib/db-errors"

export const UNDO_CHANGED_SINCE = "Someone changed this task since. Refresh to see the latest."
export const UNDO_NOT_POSSIBLE = "This change can't be undone here."

type DbError = { code?: string; message: string } | null | undefined

/**
 * Why public.undo_activity refused to reverse a task change, in plain words.
 * It refuses rather than overwrite a newer edit, or undo the same change twice.
 */
export function undoErrorMessage(error: DbError): string {
  switch (error?.code) {
    case "40001": // serialization_failure: a field the change set has changed since
      return UNDO_CHANGED_SINCE
    case "23505": // unique_violation: already undone
      return "That change was already undone."
    case "P0002": // no_data_found: the task or the log entry is gone
      return "This task no longer exists. Refresh to see the latest."
    default:
      return friendlyDbError(error, "Couldn't undo. Please try again.")
  }
}
