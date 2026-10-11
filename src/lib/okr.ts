/**
 * Key-result progress, one rule for the whole app (This Week, profiles, and the
 * OKRs page): progress runs from a key result's start value to its target, and
 * the percent shown never reads 100 before the target is reached.
 */

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

/** A key result's whole percent, 0–100: `progressPercent(krProgress(kr))`. */
export function krPercent(kr: KrValues): number {
  return progressPercent(krProgress(kr))
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
