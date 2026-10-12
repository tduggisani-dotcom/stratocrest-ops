import { staleLabel } from "@/features/this-week/logic"
import { formatDate, formatTime, relativeDay, toEtDate, type IsoDate } from "@/lib/dates"
import { contactMethodLabels, orgRegionLabels, orgStageLabel, orgSubtypeLabels } from "@/lib/labels"
import type { OrgKind } from "../kind-config"
import type { OrgListItem } from "../queries/list"

/**
 * What the table and the cards show for one org, worked out once so both
 * say exactly the same thing. Pure: `today` comes from the server (todayEt()).
 */

/** Green only for a strong rating (4–5); 1–3 stay neutral (spec §7). */
export function ratingTone(rating: number): "good" | "neutral" {
  return rating >= 4 ? "good" : "neutral"
}

/** "4/5" */
export function ratingText(rating: number): string {
  return `${rating}/5`
}

/** "Oct 3", or "Oct 3, 2025" when it isn't this year. */
export function dayLabel(date: IsoDate, today: IsoDate): string {
  const label = formatDate(date, "short")
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${date.slice(0, 4)}`
}

/** "VC · Meeting" (subtype, when set, then stage). */
export function companyMeta(
  kind: OrgKind,
  org: Pick<OrgListItem, "subtype" | "stage" | "stage_label">,
): string {
  const stage = org.stage_label ?? (org.stage ? orgStageLabel(kind, org.stage) : null)
  return [org.subtype ? orgSubtypeLabels[org.subtype] : null, stage].filter(Boolean).join(" · ")
}

/** "Columbus, OH", or null when neither part is set. */
export function locationText(org: Pick<OrgListItem, "city" | "state_or_country">): string | null {
  const text = [org.city, org.state_or_country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")
  return text || null
}

export function regionText(org: Pick<OrgListItem, "region">): string | null {
  return org.region ? orgRegionLabels[org.region] : null
}

/** First contact: the day and how (both optional). */
export function firstContact(
  org: Pick<OrgListItem, "first_contact_date" | "first_contact_method">,
  today: IsoDate,
): { date: string | null; method: string | null } {
  return {
    date: org.first_contact_date ? dayLabel(org.first_contact_date, today) : null,
    method: org.first_contact_method ? contactMethodLabels[org.first_contact_method] : null,
  }
}

export type MeetingDates = {
  /** The most recent meeting that happened: "Oct 3" · "9 days ago". */
  latest: { date: IsoDate; label: string; relative: string } | null
  /** The next scheduled one: "Oct 20, 2:00 PM" · "in 8 days". */
  next: { at: string; label: string; relative: string } | null
}

export function meetingDates(
  org: Pick<OrgListItem, "latest_meeting_at" | "next_meeting_at">,
  today: IsoDate,
): MeetingDates {
  const latestDay = org.latest_meeting_at ? toEtDate(org.latest_meeting_at) : null
  const nextDay = org.next_meeting_at ? toEtDate(org.next_meeting_at) : null
  return {
    latest: latestDay
      ? {
          date: latestDay,
          label: dayLabel(latestDay, today),
          relative: relativeDay(latestDay, today),
        }
      : null,
    next:
      org.next_meeting_at && nextDay
        ? {
            at: org.next_meeting_at,
            label: `${dayLabel(nextDay, today)}, ${formatTime(org.next_meeting_at)}`,
            relative: relativeDay(nextDay, today),
          }
        : null,
  }
}

/** The amber marker ("No contact in 21 days"), or null when the org isn't stale. */
export function staleText(
  org: Pick<OrgListItem, "is_stale" | "days_since_contact" | "last_contact_date">,
): string | null {
  if (!org.is_stale || org.days_since_contact === null) return null
  return staleLabel(org.days_since_contact, org.last_contact_date)
}

/** A finished org (won or lost) has no follow-up, so its next-step date is never "overdue". */
export function isClosed(org: Pick<OrgListItem, "stage_outcome">): boolean {
  return org.stage_outcome !== null && org.stage_outcome !== "open"
}
