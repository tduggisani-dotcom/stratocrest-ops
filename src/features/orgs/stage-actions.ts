"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { orgIdSchema, orgKindMessages } from "@/lib/schemas/organizations"
import { createClient } from "@/lib/supabase/server"
import { isStageOf } from "./kind-config"
import type { OrgActionResult } from "./types"

const GONE = "This record was removed or no longer exists. Refresh to see the latest."

/**
 * Moves an org to another stage of its kind: the org page's stage menu, the
 * board's drag and "Move to" menu, and their Undo (which calls this again with
 * the previous stage). Reads the org's kind first, so an investor can't be put
 * in a customer stage (the database's foreign key says the same). RLS applies;
 * the trigger queues org.stage_changed and the audit log records the move.
 * Archived orgs keep their stage until they're restored.
 */
export async function changeOrgStage(orgId: string, stage: string): Promise<OrgActionResult> {
  await requireTeamMember()
  const id = orgIdSchema.safeParse(orgId)
  if (!id.success || typeof stage !== "string") return { status: "error", message: GONE }

  const supabase = await createClient()
  const { data: org, error: readError } = await supabase
    .from("organizations")
    .select("kind, stage, archived_at")
    .eq("id", id.data)
    .maybeSingle()
  if (readError) {
    console.error("Reading an org failed", { code: readError.code })
    return { status: "error", message: friendlyDbError(readError) }
  }
  if (!org) return { status: "error", message: GONE }

  const messages = orgKindMessages(org.kind)
  if (org.archived_at) return { status: "error", message: messages.archived }
  if (!isStageOf(org.kind, stage)) return { status: "error", message: messages.stage }
  if (org.stage === stage) return { status: "success" }

  const { data, error } = await supabase
    .from("organizations")
    .update({ stage })
    .eq("id", id.data)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()
  if (error) {
    console.error("Changing an org's stage failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error, "Couldn't change the stage.") }
  }
  if (!data) return { status: "error", message: messages.org }

  refresh()
  return { status: "success" }
}
