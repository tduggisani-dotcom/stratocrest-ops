import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"
import type { HypothesisActionResult } from "./types"

const connectionFailed: HypothesisActionResult = { status: "error", message: CONNECTION_ERROR }

/**
 * Calls a hypothesis Server Action from a button (status, archive, restore).
 * A failed request (lost signal, server error) comes back as an error result,
 * so the caller's error toast runs instead of the error screen.
 */
export function callHypothesisAction(
  call: () => Promise<HypothesisActionResult>,
): Promise<HypothesisActionResult> {
  return callAction(call, connectionFailed)
}
