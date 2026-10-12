import type { OrgSortKey, RatingFilter, SortDirection } from "../filters"
import type { OrgOverviewRow } from "../types"

/**
 * The pure parts of the tracker query (src/features/orgs/queries/list.ts):
 * the ORDER BY for each sort, the name search pattern and the rating filter.
 * Kept apart from the Supabase call so they can be unit tested.
 */

type Column = keyof OrgOverviewRow & string

/** The org_overview columns each sort orders by, before the name and id tie-break. */
export const SORT_COLUMNS: Record<OrgSortKey, readonly Column[]> = {
  next_step: ["next_step_date"],
  name: ["name"],
  location: ["city", "state_or_country"],
  first_contact: ["first_contact_date"],
  latest_meeting: ["latest_meeting_at"],
  next_meeting: ["next_meeting_at"],
  owner: ["owner_name"],
  rating: ["latest_rating"],
  stage: ["stage_position"],
}

export type OrderStep = { column: Column; ascending: boolean }

/**
 * The full ORDER BY for a sort: its columns in `dir`, then name and id
 * ascending, so equal rows keep a stable order. The query puts empty values
 * last in both directions ("no rating" never tops a highest-first list).
 */
export function orderSteps(sort: OrgSortKey, dir: SortDirection): OrderStep[] {
  const ascending = dir === "asc"
  const steps: OrderStep[] = SORT_COLUMNS[sort].map((column) => ({ column, ascending }))
  if (sort !== "name") steps.push({ column: "name", ascending: true })
  steps.push({ column: "id", ascending: true })
  return steps
}

/**
 * The ILIKE pattern for a name search: a case-insensitive "contains", with
 * the user's `\`, `%` and `_` taken literally. PostgREST reads `*` as `%` and
 * has no escape for it, so a `*` matches any one character instead.
 */
export function likePattern(q: string): string {
  const escaped = q.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, "_")
  return `%${escaped}%`
}

/** How the rating facet narrows `latest_rating` (the org's most recent meeting that happened). */
export type RatingCondition =
  | { kind: "in"; values: number[] }
  | { kind: "unrated" }
  | { kind: "in_or_unrated"; expression: string }

/** Null when the facet is off. "none" means no rated meeting yet (latest_rating is null). */
export function ratingCondition(ratings: readonly RatingFilter[]): RatingCondition | null {
  const values = ratings
    .filter((rating) => rating !== "none")
    .map(Number)
    .sort((a, b) => b - a)
  const unrated = ratings.includes("none")
  if (values.length > 0 && unrated) {
    return {
      kind: "in_or_unrated",
      expression: `latest_rating.in.(${values.join(",")}),latest_rating.is.null`,
    }
  }
  if (values.length > 0) return { kind: "in", values }
  return unrated ? { kind: "unrated" } : null
}
