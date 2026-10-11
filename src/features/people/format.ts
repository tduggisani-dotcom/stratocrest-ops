import { availabilityLabelLabels } from "@/lib/labels"
import { addDays, formatDate, type IsoDate } from "@/lib/dates"
import type { Enums } from "@/types/database"

/**
 * Pure display helpers for people pages: weekdays, wall-clock times, crunch
 * periods and key-result progress. No time zones are involved: availability
 * times are ET wall-clock strings and crunch dates are ET calendar days.
 */

export type AvailabilityLabel = Enums<"availability_label">

/** ISO weekdays, Monday first (1 = Monday … 7 = Sunday), matching availability_blocks.weekday. */
export const WEEKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const

export function weekdayName(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.label ?? `Day ${weekday}`
}

/** "09:00" or "09:00:00" -> "9:00 AM"; "00:30" -> "12:30 AM"; "12:00" -> "12:00 PM". */
export function formatClockTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!match) return time
  const hour = Number(match[1])
  const suffix = hour >= 12 ? "PM" : "AM"
  return `${hour % 12 || 12}:${match[2]} ${suffix}`
}

/** "9:00 AM – 12:00 PM" */
export function formatTimeRange(start: string, end: string): string {
  return `${formatClockTime(start)} – ${formatClockTime(end)}`
}

/** "HH:MM:SS" (from Postgres) -> "HH:MM", for <input type="time"> and comparisons. */
export function toHourMinute(time: string): string {
  return time.slice(0, 5)
}

export type AvailabilityBlock = {
  id: string
  weekday: number
  /** "HH:MM", ET wall clock. */
  startTime: string
  endTime: string
  label: AvailabilityLabel
  note: string | null
}

export type AvailabilityDay = {
  weekday: number
  label: string
  blocks: AvailabilityBlock[]
}

/** All seven days, Monday first, each with its blocks in start-time order. */
export function groupByWeekday(blocks: readonly AvailabilityBlock[]): AvailabilityDay[] {
  return WEEKDAYS.map((day) => ({
    weekday: day.value,
    label: day.label,
    blocks: blocks
      .filter((b) => b.weekday === day.value)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)),
  }))
}

/** "Monday 9:00 AM class block": names a block for its Remove button and toasts. */
export function availabilityBlockName(
  block: Pick<AvailabilityBlock, "weekday" | "startTime" | "label">,
) {
  const label = availabilityLabelLabels[block.label].toLowerCase()
  return `${weekdayName(block.weekday)} ${formatClockTime(block.startTime)} ${label} block`
}

export type CrunchPeriodItem = {
  id: string
  label: string
  startDate: IsoDate
  endDate: IsoDate
}

export type CrunchPeriodView = CrunchPeriodItem & {
  /** Today falls inside it. */
  isCurrent: boolean
}

/** How many finished crunch periods a profile shows. */
export const PAST_CRUNCH_LIMIT = 3

/**
 * Current and upcoming periods (soonest first), then the most recent finished
 * ones (latest first, at most `PAST_CRUNCH_LIMIT`).
 */
export function splitCrunchPeriods(
  periods: readonly CrunchPeriodItem[],
  today: IsoDate,
): { upcoming: CrunchPeriodView[]; past: CrunchPeriodView[] } {
  const upcoming = periods
    .filter((p) => p.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))
    .map((p) => ({ ...p, isCurrent: p.startDate <= today }))
  const past = periods
    .filter((p) => p.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate))
    .slice(0, PAST_CRUNCH_LIMIT)
    .map((p) => ({ ...p, isCurrent: false }))
  return { upcoming, past }
}

/** "Dec 7 – Dec 18", or "Dec 7" for a one-day period. */
export function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) return formatDate(start, "short")
  return `${formatDate(start, "short")} – ${formatDate(end, "short")}`
}

/** "Happening now · ends Dec 18" / "Starts tomorrow" / "Starts Dec 7" / "Ended Oct 1". */
export function crunchTiming(period: CrunchPeriodItem, today: IsoDate): string {
  if (period.endDate < today) return `Ended ${formatDate(period.endDate, "short")}`
  if (period.startDate <= today) {
    return period.endDate === today
      ? "Happening now · ends today"
      : `Happening now · ends ${formatDate(period.endDate, "short")}`
  }
  if (period.startDate === addDays(today, 1)) return "Starts tomorrow"
  return `Starts ${formatDate(period.startDate, "short")}`
}

/**
 * Key-result progress in whole percent, 0–100:
 * (current − start) / (target − start). Works for targets below the start too
 * (e.g. "cut cost per liner from $12 to $8").
 */
export function keyResultProgress(kr: { start: number; target: number; current: number }): number {
  const span = kr.target - kr.start
  if (!Number.isFinite(span) || span === 0) return 0
  const ratio = (kr.current - kr.start) / span
  if (!Number.isFinite(ratio)) return 0
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100)
}

/** "1 open task" / "3 open tasks". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Count rows per key, e.g. open tasks per owner id. */
export function countBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}
