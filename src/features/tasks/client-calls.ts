import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"

/** What a button shows when its Server Action call failed. */
export type TaskActionError = { status: "error"; message: string }

const connectionFailed: TaskActionError = { status: "error", message: CONNECTION_ERROR }

/**
 * Calls a task Server Action from a button (status, archive, restore, undo).
 * A failed request (lost signal, server error) comes back as an error result,
 * so the caller's usual error toast and snap-back run instead of the error
 * screen replacing the page.
 */
export function callTaskAction<T>(call: () => Promise<T>): Promise<T | TaskActionError> {
  return callAction<T | TaskActionError>(call, connectionFailed)
}
