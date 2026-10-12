import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"
import type { OrgActionResult } from "../types"

const connectionFailed: OrgActionResult = { status: "error", message: CONNECTION_ERROR }

/**
 * Calls an org Server Action from a button (stage, archive, restore). A failed
 * request (lost signal, server error) comes back as an error result, so the
 * caller's error toast runs instead of the error screen replacing the page.
 */
export function callOrgAction(call: () => Promise<OrgActionResult>): Promise<OrgActionResult> {
  return callAction(call, connectionFailed)
}
