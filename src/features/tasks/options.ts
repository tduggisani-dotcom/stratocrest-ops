import type { CrunchPeriod } from "@/lib/crunch"
import { formatDate, formatDateTime, type IsoDate } from "@/lib/dates"
import type { Database } from "@/types/database"

/**
 * Choices for the task form's owner picker and "Link to…" selects, with the
 * labels people see. Pure, so the labels are unit-tested; queries.ts loads them.
 */

type OrgKind = Database["public"]["Enums"]["org_kind"]

export type LinkOption = { value: string; label: string }
export type OrgOption = LinkOption & { kind: OrgKind }

export type TaskFormOptions = {
  people: { id: string; name: string }[]
  /** Every crunch period, for the live "falls in X's crunch period" warning. */
  crunchPeriods: CrunchPeriod[]
  organizations: OrgOption[]
  sessions: LinkOption[]
  keyResults: LinkOption[]
  teamMeetings: LinkOption[]
  orgMeetings: LinkOption[]
}

const MAX_LABEL = 72

/** Cuts long labels so a native select stays inside a phone screen. */
export function truncateLabel(text: string, max = MAX_LABEL): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/** "Oct 14", or "Oct 19 – Oct 23" for a multi-day session. */
function dayOrRange(start: IsoDate, end: IsoDate): string {
  return start === end
    ? formatDate(start, "short")
    : `${formatDate(start, "short")} – ${formatDate(end, "short")}`
}

/** "W2 · Oct 14 · Goal Setting & OKRs + CliftonStrengths". */
export function sessionLabel(session: {
  week_label: string | null
  start_date: IsoDate
  end_date: IsoDate
  topic: string | null
  activity_type: string
}): string {
  const parts = [
    session.week_label,
    dayOrRange(session.start_date, session.end_date),
    session.topic?.trim() || session.activity_type,
  ]
  return truncateLabel(parts.filter(Boolean).join(" · "))
}

/** "Sun, Oct 11 (today)". */
export function teamMeetingLabel(meetingDate: IsoDate, today: IsoDate): string {
  const when = meetingDate === today ? " (today)" : meetingDate > today ? " (upcoming)" : ""
  return `${formatDate(meetingDate, "medium")}${when}`
}

/** "Example Seed Fund · Wed, Oct 14, 3:00 PM". */
export function orgMeetingLabel(orgName: string, startsAt: string): string {
  const when = formatDateTime(startsAt)
  return `${truncateLabel(orgName, MAX_LABEL - when.length - 3)} · ${when}`
}

/** "Q1 · Book 10 investor meetings". */
export function keyResultLabel(title: string, quarterLabel: string | null | undefined): string {
  return truncateLabel(quarterLabel ? `${quarterLabel} · ${title}` : title)
}

/**
 * Makes sure an item the task already links to stays selectable, even when the
 * option list leaves it out (an older session, an archived org). Otherwise the
 * select would show "None" and saving would silently drop the link.
 */
export function withCurrent<O extends LinkOption>(options: readonly O[], current: O | null): O[] {
  if (!current || options.some((o) => o.value === current.value)) return [...options]
  return [current, ...options]
}

/** A prefilled id (from ?org=… etc.) counts only if it is one of the choices. */
export function pickOption(options: readonly LinkOption[], value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" && options.some((o) => o.value === first) ? first : ""
}
