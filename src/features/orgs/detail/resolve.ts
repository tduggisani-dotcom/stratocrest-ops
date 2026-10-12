import "server-only"
import { cache } from "react"
import { notFound } from "next/navigation"
import { requireTeamMember } from "@/lib/auth"
import { todayEt, type IsoDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import type { OrgKind } from "../kind-config"
import { getOrg, type OrgDetail } from "../queries/detail"

/** The org page's route params. */
export type OrgParams = Promise<{ id: string }>

/**
 * The id from the URL, once the session is checked. A malformed id is a 404
 * straight away, so section queries can start before the org itself loads.
 */
export async function orgIdFrom(params: OrgParams): Promise<string> {
  const [{ id }] = await Promise.all([params, requireTeamMember()])
  if (!isRecordId(id)) notFound()
  return id
}

/** The org for this page, or the page's 404 (unknown id, or one of the other kind). */
export async function orgOrNotFound(kind: OrgKind, id: string): Promise<OrgDetail> {
  const org = await getOrg(kind, id)
  if (!org) notFound()
  return org
}

/** One "today" (ET) per request, so every section agrees on what's overdue. */
export const requestToday = cache((): IsoDate => todayEt())
