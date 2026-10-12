import { daysBetween, type IsoDate } from "@/lib/dates"

/**
 * Small pure helpers for the org page (unit-tested in format.test.ts).
 */

/** "example.com/team" for "https://www.example.com/team/": short enough for a phone. */
export function displayLink(link: string): string {
  if (!URL.canParse(link)) return link
  const url = new URL(link)
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")
  return `${url.host.replace(/^www\./, "")}${path}`
}

/** "Akron, OH", "Akron", "Germany" or null. */
export function locationLine(city: string | null, stateOrCountry: string | null): string | null {
  const parts = [city, stateOrCountry].filter((p): p is string => Boolean(p?.trim()))
  return parts.length > 0 ? parts.join(", ") : null
}

/**
 * "tel:+13305550100" for "+1 (330) 555-0100" (an extension is left off), or
 * null when there's no number to dial.
 */
export function telHref(phone: string): string | null {
  const main = phone.split(/ext|x|#/i)[0] ?? ""
  const dial = main.trim().replace(/(?!^\+)[^\d]/g, "")
  return /\d{3,}/.test(dial) ? `tel:${dial}` : null
}

export type DebriefState =
  | { kind: "done" }
  | { kind: "overdue"; days: number }
  | { kind: "due_today" }
  | { kind: "upcoming" }

/** A debrief's state on `today`: done, overdue (red), due today, or not due yet. */
export function debriefState(
  debrief: { status: "due" | "done"; dueDate: IsoDate },
  today: IsoDate,
): DebriefState {
  if (debrief.status === "done") return { kind: "done" }
  const diff = daysBetween(today, debrief.dueDate)
  if (diff < 0) return { kind: "overdue", days: -diff }
  return diff === 0 ? { kind: "due_today" } : { kind: "upcoming" }
}
