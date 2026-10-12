import { TZDate } from "@date-fns/tz"

/**
 * Dates and times for StratoCrest Ops. Everything is shown and entered in
 * America/New_York.
 *
 * - A calendar day (due date, session date) is an `IsoDate` string "YYYY-MM-DD"
 *   and is stored in a Postgres `date` column. Do day arithmetic with the
 *   helpers here, never with `new Date()` math.
 * - A moment (meeting start) is a `Date` / ISO timestamp, stored as timestamptz.
 *
 * The seed scripts import this file under plain Node (type stripping): keep it free of
 * "@/..." imports and of non-erasable TypeScript (enums, namespaces, parameter properties).
 */
export const APP_TIME_ZONE = "America/New_York"

/** "YYYY-MM-DD" */
export type IsoDate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string): value is IsoDate {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === value
}

function parts(date: IsoDate): [number, number, number] {
  if (!isIsoDate(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`)
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))]
}

/** Calendar math on a day, independent of any time zone. */
function utcNoon(date: IsoDate): Date {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

const etDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** The ET calendar day a moment falls on. */
export function toEtDate(instant: Date | string): IsoDate {
  return etDayFormatter.format(new Date(instant))
}

/** Today's date in America/New_York. Pass `now` in tests. */
export function todayEt(now: Date = new Date()): IsoDate {
  return toEtDate(now)
}

/** The moment an ET wall-clock time happens, e.g. etMoment("2026-11-01", "09:00"). */
export function etMoment(date: IsoDate, time: string): Date {
  const [y, m, d] = parts(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!t) throw new RangeError(`Not an HH:mm time: ${time}`)
  return new Date(new TZDate(y, m - 1, d, Number(t[1]), Number(t[2]), APP_TIME_ZONE).getTime())
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = utcNoon(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((utcNoon(to).getTime() - utcNoon(from).getTime()) / 86_400_000)
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: IsoDate): number {
  const day = utcNoon(date).getUTCDay()
  return day === 0 ? 7 : day
}

/** The Sunday on or after `date`. */
export function sundayOnOrAfter(date: IsoDate): IsoDate {
  return addDays(date, (7 - isoWeekday(date)) % 7)
}

/** True when `date` falls within [start, end] (inclusive). */
export function isWithin(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end
}

const dayFormats = {
  short: { month: "short", day: "numeric" },
  medium: { weekday: "short", month: "short", day: "numeric" },
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>

/** "Oct 14" | "Wed, Oct 14" | "Wednesday, October 14, 2026" */
export function formatDate(date: IsoDate, style: keyof typeof dayFormats = "medium"): string {
  // Format the calendar day itself (UTC noon) so no time-zone shift can change it.
  return new Intl.DateTimeFormat("en-US", { ...dayFormats[style], timeZone: "UTC" }).format(
    utcNoon(date),
  )
}

/** "9:00 AM" in ET. */
export function formatTime(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant))
}

/** "Wed, Oct 14, 9:00 AM" in ET. */
export function formatDateTime(instant: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant))
}

/** "today", "tomorrow", "yesterday", "in 3 days", "5 days ago". */
export function relativeDay(date: IsoDate, today: IsoDate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return "today"
  if (diff === 1) return "tomorrow"
  if (diff === -1) return "yesterday"
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}
