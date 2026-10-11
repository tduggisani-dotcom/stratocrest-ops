import type { IsoDate } from "@/lib/dates"

export type CrunchPeriod = {
  personId: string
  label: string
  startDate: IsoDate
  endDate: IsoDate
}

/**
 * The owner's crunch periods (finals, a deadline at work…) that include `date`.
 * Tasks warn — but don't block — when a due date lands in one (spec §6.4).
 */
export function crunchPeriodsCovering(
  periods: readonly CrunchPeriod[],
  personId: string,
  date: IsoDate,
): CrunchPeriod[] {
  return periods.filter((p) => p.personId === personId && p.startDate <= date && date <= p.endDate)
}

/** "Due date falls in Sam's crunch period: Finals (Dec 7 – Dec 18)." */
export function crunchWarning(
  personName: string,
  period: CrunchPeriod,
  formatDay: (date: IsoDate) => string,
): string {
  const firstName = personName.split(/\s+/)[0] ?? personName
  return `The due date falls in ${firstName}'s crunch period: ${period.label} (${formatDay(period.startDate)} – ${formatDay(period.endDate)}).`
}
