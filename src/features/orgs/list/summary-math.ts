import { etMoment, sundayOnOrAfter, type IsoDate } from "@/lib/dates"
import { kindConfig, type OrgKind } from "../kind-config"
import type { OrgListItem, OrgSummary } from "../queries/list"

/**
 * The summary bar's arithmetic, kept pure so it can be tested without a
 * database. summarizeOrgs (queries/list.ts) adds the meeting count.
 */

/** The ET calendar month that `today` falls in: [start, end), as days. */
export function etMonthRange(today: IsoDate): { start: IsoDate; end: IsoDate } {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    start: `${today.slice(0, 7)}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  }
}

/** The same month as moments (midnight ET to midnight ET), for a timestamptz query. */
export function etMonthMoments(today: IsoDate): { from: string; to: string } {
  const { start, end } = etMonthRange(today)
  return {
    from: etMoment(start, "00:00").toISOString(),
    to: etMoment(end, "00:00").toISOString(),
  }
}

/** Mean of the ratings that exist, to one decimal; null when there are none. */
export function averageRating(ratings: readonly (number | null)[]): number | null {
  const rated = ratings.filter((rating): rating is number => rating !== null)
  if (rated.length === 0) return null
  const mean = rated.reduce((sum, rating) => sum + rating, 0) / rated.length
  return Math.round(mean * 10) / 10
}

/** How many of the meetings (one org id per meeting) belong to the listed orgs. */
export function countMeetingsFor(
  meetingOrgIds: readonly string[],
  orgs: readonly Pick<OrgListItem, "id">[],
): number {
  const ids = new Set(orgs.map((org) => org.id))
  return meetingOrgIds.filter((id) => ids.has(id)).length
}

/** Everything in the summary bar except the meeting count (which needs a query). */
export function summarizeRows(
  kind: OrgKind,
  orgs: readonly Pick<
    OrgListItem,
    "stage" | "latest_rating" | "stage_outcome" | "next_step_date"
  >[],
  today: IsoDate,
): Omit<OrgSummary, "meetingsThisMonth"> {
  const weekEnd = sundayOnOrAfter(today)
  return {
    total: orgs.length,
    byStage: kindConfig(kind).stages.map((stage) => ({
      stage: stage.value,
      label: stage.label,
      count: orgs.filter((org) => org.stage === stage.value).length,
    })),
    averageRating: averageRating(orgs.map((org) => org.latest_rating)),
    followUpsDueThisWeek: orgs.filter(
      (org) =>
        org.stage_outcome === "open" &&
        org.next_step_date !== null &&
        org.next_step_date <= weekEnd,
    ).length,
  }
}
