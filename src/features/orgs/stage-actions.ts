"use server"

import type { OrgActionResult } from "./types"

/**
 * CONTRACT (Stage 3 build; the detail agent implements it, the board reuses
 * it). Moves an org to another stage of its kind (RLS applies; the stage must
 * belong to the org's kind). Keep this signature.
 */
export async function changeOrgStage(_orgId: string, _stage: string): Promise<OrgActionResult> {
  return { status: "error", message: "Not built yet." }
}
