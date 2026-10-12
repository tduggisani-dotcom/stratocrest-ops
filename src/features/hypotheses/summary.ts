import { HYPOTHESIS_STATUSES, TEST_OUTCOMES } from "@/lib/labels"
import type { EvidenceSummary, HypothesisStatus, TestOutcome } from "./types"

/**
 * Pure helpers for the hypothesis lists: the evidence tally and latest test,
 * the order tests are shown in, and the roll-up's grouping by status.
 */

type TestRow = { test_date: string; outcome: TestOutcome; evidence: string; created_at: string }

/** Newest first: by test date, then by when it was written down. */
export function newestFirst<T extends { test_date: string; created_at: string }>(
  tests: readonly T[],
): T[] {
  return [...tests].sort(
    (a, b) => b.test_date.localeCompare(a.test_date) || b.created_at.localeCompare(a.created_at),
  )
}

/** The tally by outcome and the most recent test. */
export function summarizeEvidence(tests: readonly TestRow[]): EvidenceSummary {
  const counts = Object.fromEntries(TEST_OUTCOMES.map((o) => [o, 0])) as Record<TestOutcome, number>
  for (const test of tests) counts[test.outcome] += 1
  const latest = newestFirst(tests)[0]
  return {
    counts,
    total: tests.length,
    latest: latest
      ? { testDate: latest.test_date, outcome: latest.outcome, evidence: latest.evidence }
      : null,
  }
}

const VERBS: Record<TestOutcome, [one: string, many: string]> = {
  supports: ["supports", "support"],
  contradicts: ["contradicts", "contradict"],
  inconclusive: ["inconclusive", "inconclusive"],
}

/** "No evidence yet" | "2 support, 1 contradicts" | "1 inconclusive". */
export function evidenceText(summary: Pick<EvidenceSummary, "counts" | "total">): string {
  if (summary.total === 0) return "No evidence yet"
  return TEST_OUTCOMES.filter((o) => summary.counts[o] > 0)
    .map((o) => {
      const n = summary.counts[o]
      return `${n} ${VERBS[o][n === 1 ? 0 : 1]}`
    })
    .join(", ")
}

/**
 * The roll-up's three sections, in status order. Within each, the most
 * recently tested first, then the newest.
 */
export function groupByStatus<
  T extends {
    status: HypothesisStatus
    createdAt: string
    evidence: Pick<EvidenceSummary, "latest">
  },
>(items: readonly T[]): { status: HypothesisStatus; items: T[] }[] {
  const sorted = [...items].sort(
    (a, b) =>
      (b.evidence.latest?.testDate ?? "").localeCompare(a.evidence.latest?.testDate ?? "") ||
      b.createdAt.localeCompare(a.createdAt),
  )
  return HYPOTHESIS_STATUSES.map((status) => ({
    status,
    items: sorted.filter((item) => item.status === status),
  }))
}
