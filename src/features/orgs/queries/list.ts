import "server-only"
import { todayEt } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { OrgFilters } from "../filters"
import type { OrgKind } from "../kind-config"
import { likePattern, orderSteps, ratingCondition } from "../list/query-helpers"
import { countMeetingsFor, etMonthMoments, summarizeRows } from "../list/summary-math"
import type { OrgOverviewRow } from "../types"

/**
 * The tracker's reads, shared by the table, the cards, the board and the CSV
 * export. Server-only; each runs as the signed-in person (RLS applies) and
 * throws on a database error so the page shows its retry screen. Call them
 * after requireTeamMember().
 */

/** One org in the table, the cards, the board and the CSV. */
export type OrgListItem = OrgOverviewRow

/** The summary bar for the current filtered view. */
export type OrgSummary = {
  total: number
  /** Count per stage, in pipeline order (every stage of the kind, zeros included). */
  byStage: { stage: string; label: string; count: number }[]
  /** Meetings (held or scheduled) with these orgs in the current ET calendar month. */
  meetingsThisMonth: number
  /** Average of each org's latest rating, among orgs that have one; null when none. */
  averageRating: number | null
  /** Open orgs whose next step is due on or before this Sunday (overdue included). */
  followUpsDueThisWeek: number
}

/** Orgs of `kind` matching `filters`, sorted by `filters.sort`/`dir`. Throws on error. */
export async function listOrgs(kind: OrgKind, filters: OrgFilters): Promise<OrgListItem[]> {
  const supabase = await createClient()
  let query = supabase.from("org_overview").select("*").eq("kind", kind)

  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null)
  if (filters.stages.length > 0) query = query.in("stage", filters.stages)
  if (filters.owners.length > 0) query = query.in("owner_id", filters.owners)
  if (filters.regions.length > 0) query = query.in("region", filters.regions)
  if (filters.stale) query = query.eq("is_stale", true)
  if (filters.q) query = query.ilike("name", likePattern(filters.q))

  const rating = ratingCondition(filters.ratings)
  if (rating?.kind === "in") query = query.in("latest_rating", rating.values)
  else if (rating?.kind === "unrated") query = query.is("latest_rating", null)
  else if (rating?.kind === "in_or_unrated") query = query.or(rating.expression)

  for (const step of orderSteps(filters.sort, filters.dir)) {
    query = query.order(step.column, { ascending: step.ascending, nullsFirst: false })
  }

  const { data, error } = await query
  if (error) throw new Error(`Couldn't load the list: ${error.message}`)
  return data
}

/** Summary bar numbers for `orgs` (already filtered by listOrgs). Throws on error. */
export async function summarizeOrgs(kind: OrgKind, orgs: OrgListItem[]): Promise<OrgSummary> {
  const today = todayEt()
  const rows = summarizeRows(kind, orgs, today)
  if (orgs.length === 0) return { ...rows, meetingsThisMonth: 0 }

  // One small read: this month's meetings (all orgs), counted for the listed ones here.
  // Filtering by id in the URL would break once a list holds a few hundred orgs.
  const { from, to } = etMonthMoments(today)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("org_meetings")
    .select("organization_id")
    .gte("starts_at", from)
    .lt("starts_at", to)
  if (error) throw new Error(`Couldn't count this month's meetings: ${error.message}`)

  return {
    ...rows,
    meetingsThisMonth: countMeetingsFor(
      data.map((meeting) => meeting.organization_id),
      orgs,
    ),
  }
}

/** How many archived orgs of `kind` there are (for "Show archived (n)"). Throws on error. */
export async function countArchivedOrgs(kind: OrgKind): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .not("archived_at", "is", null)
  if (error) throw new Error(`Couldn't count archived records: ${error.message}`)
  return count ?? 0
}
