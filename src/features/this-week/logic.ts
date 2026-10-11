import {
  etMoment,
  formatDate,
  formatTime,
  isWithin,
  relativeDay,
  sundayOnOrAfter,
  toEtDate,
  type IsoDate,
} from "@/lib/dates"
import { debriefKindLabels } from "@/lib/labels"
import type { Database } from "@/types/database"

/**
 * Pure rules behind the This Week page (spec §6.1): what "this week" means,
 * sorting, who has posted an update, OKR progress, and the small labels the
 * cards show. Kept free of I/O so they are unit-tested.
 */

type Enums = Database["public"]["Enums"]
type TaskPriority = Enums["task_priority"]

/** How many items each list shows before "See all". */
export const LIMITS = { myTasks: 8, myOther: 5, attention: 5, orgMeetings: 10 } as const

/**
 * The last day of "this week": this Sunday, which is today on a Sunday (the
 * same rule as the Tasks "Due this week" view).
 */
export function weekEnd(today: IsoDate): IsoDate {
  return sundayOnOrAfter(today)
}

/** How many more items exist than the list shows (0 when the count is unknown). */
export function moreCount(total: number | null | undefined, shown: number): number {
  return Math.max(0, (total ?? shown) - shown)
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

type SortableTask = { id: string; title: string; dueDate: IsoDate; priority: TaskPriority }

/** Soonest due first (so overdue comes first), then high priority, then by title. */
export function compareTasksByDue(a: SortableTask, b: SortableTask): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (byPriority !== 0) return byPriority
  return a.title.localeCompare(b.title, "en-US") || a.id.localeCompare(b.id)
}

// ---------------------------------------------------------------------------
// Sunday meeting: who has posted their pre-meeting update
// ---------------------------------------------------------------------------

type OrderedPerson = { id: string; name: string; sortOrder: number }

/**
 * Splits the team for the pre-meeting update row. Posted = everyone with a
 * submitted update (a deactivated teammate who already posted still counts),
 * in team order. Not posted = active teammates without one, in team order.
 */
export function splitByPosted<P extends OrderedPerson>(
  activePeople: readonly P[],
  updates: readonly { submittedAt: string | null; person: P }[],
): { posted: P[]; notPosted: P[] } {
  const posted = new Map<string, P>()
  for (const update of updates) {
    if (update.submittedAt) posted.set(update.person.id, update.person)
  }
  return {
    posted: [...posted.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en-US"),
    ),
    notPosted: activePeople.filter((p) => !posted.has(p.id)),
  }
}

// ---------------------------------------------------------------------------
// OKRs
// ---------------------------------------------------------------------------

type QuarterDates = { startDate: IsoDate; endDate: IsoDate }

/**
 * The quarter This Week shows: the one whose dates include today, else the
 * next one to start (before Q1 begins on Oct 14 that is Q1). Null once the
 * last quarter has ended.
 */
export function pickQuarter<Q extends QuarterDates>(
  quarters: readonly Q[],
  today: IsoDate,
): { quarter: Q; status: "current" | "upcoming" } | null {
  const current = quarters.find((q) => isWithin(today, q.startDate, q.endDate))
  if (current) return { quarter: current, status: "current" }
  const upcoming = quarters
    .filter((q) => q.startDate > today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))[0]
  return upcoming ? { quarter: upcoming, status: "upcoming" } : null
}

export type KrValues = { startValue: number; targetValue: number; currentValue: number }

/**
 * Progress of a key result from its start value to its target, 0..1. Works for
 * targets below the start (e.g. "cut cost per unit"). The DB forbids
 * target = start; if it ever happens, reaching the target counts as done.
 */
export function krProgress({ startValue, targetValue, currentValue }: KrValues): number {
  const span = targetValue - startValue
  if (span === 0 || !Number.isFinite(span)) return currentValue === targetValue ? 1 : 0
  const progress = (currentValue - startValue) / span
  if (!Number.isFinite(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

/** Whole percent for the bar and screen readers: never 100 before done, never 0 after a start. */
export function progressPercent(progress: number): number {
  const percent = Math.round(progress * 100)
  if (percent === 100 && progress < 1) return 99
  if (percent === 0 && progress > 0) return 1
  return percent
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })

/** "$" and "%" are symbols on the number; any other unit is a word after it. */
function isSymbolUnit(unit: string): unit is "$" | "%" {
  return unit === "$" || unit === "%"
}

/** A key-result number with its unit: "$12,500", "40%", "3 meetings". */
export function formatKrValue(value: number, unit: string | null): string {
  const u = unit?.trim() ?? ""
  if (u === "$")
    return value < 0 ? `-$${numberFormat.format(-value)}` : `$${numberFormat.format(value)}`
  if (u === "%") return `${numberFormat.format(value)}%`
  return u ? `${numberFormat.format(value)} ${u}` : numberFormat.format(value)
}

/** "3 of 10 meetings", "$2,000 of $10,000", "30% of 50%". */
export function krProgressText(kr: KrValues & { unit: string | null }): string {
  const u = kr.unit?.trim() ?? ""
  const current = isSymbolUnit(u)
    ? formatKrValue(kr.currentValue, u)
    : numberFormat.format(kr.currentValue)
  return `${current} of ${formatKrValue(kr.targetValue, u || null)}`
}

// ---------------------------------------------------------------------------
// Synthe6 sessions
// ---------------------------------------------------------------------------

/** "Wed, Oct 14", or a range for multi-day sessions: "Mon, Oct 19 – Fri, Oct 23". */
export function sessionDateLabel(startDate: IsoDate, endDate: IsoDate): string {
  const start = formatDate(startDate, "medium")
  return startDate === endDate ? start : `${start} – ${formatDate(endDate, "medium")}`
}

/** "today" while a session is on (any day of a range), else "tomorrow" / "in 3 days". */
export function sessionCountdown(startDate: IsoDate, endDate: IsoDate, today: IsoDate): string {
  return isWithin(today, startDate, endDate) ? "today" : relativeDay(startDate, today)
}

const TIME = /^(\d{2}):(\d{2})/

/**
 * "6:00 PM – 8:00 PM" (ET) from Postgres `time` values ("18:00:00"), or null
 * when the time isn't known yet (sessions are all-day until then).
 */
export function sessionTimeLabel(
  date: IsoDate,
  startTime: string | null,
  endTime: string | null,
): string | null {
  const start = startTime ? TIME.exec(startTime) : null
  if (!start) return null
  const startLabel = formatTime(etMoment(date, `${start[1]}:${start[2]}`))
  const end = endTime ? TIME.exec(endTime) : null
  return end ? `${startLabel} – ${formatTime(etMoment(date, `${end[1]}:${end[2]}`))}` : startLabel
}

// ---------------------------------------------------------------------------
// Debriefs, help requests, investors and customers
// ---------------------------------------------------------------------------

export type DebriefEvent = {
  kind: Enums["debrief_kind"]
  session: { weekLabel: string | null; topic: string | null; activityType: string } | null
  orgMeeting: { startsAt: string; orgName: string | null } | null
  teamMeeting: { meetingDate: IsoDate } | null
}

/** What a debrief is about: "W2 · Goal Setting", "Acme Ventures, Oct 4", "Sunday meeting, Oct 11". */
export function debriefSubject(debrief: DebriefEvent): string {
  if (debrief.session) {
    const { weekLabel, topic, activityType } = debrief.session
    return [weekLabel, topic?.trim() || activityType].filter(Boolean).join(" · ")
  }
  if (debrief.orgMeeting) {
    const day = formatDate(toEtDate(debrief.orgMeeting.startsAt), "short")
    return `${debrief.orgMeeting.orgName ?? debriefKindLabels[debrief.kind]}, ${day}`
  }
  if (debrief.teamMeeting) {
    return `Sunday meeting, ${formatDate(debrief.teamMeeting.meetingDate, "short")}`
  }
  return debriefKindLabels[debrief.kind]
}

/** "No contact in 19 days", or "Never contacted · added 15 days ago" when there's no contact yet. */
export function staleLabel(daysSinceContact: number, lastContactDate: IsoDate | null): string {
  const days = `${daysSinceContact} ${daysSinceContact === 1 ? "day" : "days"}`
  return lastContactDate ? `No contact in ${days}` : `Never contacted · added ${days} ago`
}

/** "Asked today", "Asked yesterday", "Asked 3 days ago" (ET days). */
export function askedLabel(createdAt: string, today: IsoDate): string {
  return `Asked ${relativeDay(toEtDate(createdAt), today)}`
}

/**
 * Who from our side goes to an org meeting: the attendees in team order, or
 * the org's owner when nobody is listed yet.
 */
export function meetingPeople<P extends { id: string; sortOrder: number }>(
  attendees: readonly P[],
  owner: P,
): { people: P[]; isOwnerFallback: boolean } {
  if (attendees.length === 0) return { people: [owner], isOwnerFallback: true }
  return {
    people: [...attendees].sort((a, b) => a.sortOrder - b.sortOrder),
    isOwnerFallback: false,
  }
}

/** "in 3 days" -> "In 3 days" (countdowns that start a line). */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
