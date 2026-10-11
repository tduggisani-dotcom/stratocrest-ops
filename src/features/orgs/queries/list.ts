import "server-only"
import type { OrgFilters } from "../filters"
import type { OrgKind } from "../kind-config"
import type { OrgOverviewRow } from "../types"

/**
 * CONTRACT (Stage 3 build; the list agent implements it, the board and the
 * CSV export reuse it). Keep these signatures.
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
export async function listOrgs(_kind: OrgKind, _filters: OrgFilters): Promise<OrgListItem[]> {
  return []
}

/** Summary bar numbers for `orgs` (already filtered by listOrgs). Throws on error. */
export async function summarizeOrgs(_kind: OrgKind, _orgs: OrgListItem[]): Promise<OrgSummary> {
  return {
    total: 0,
    byStage: [],
    meetingsThisMonth: 0,
    averageRating: null,
    followUpsDueThisWeek: 0,
  }
}
