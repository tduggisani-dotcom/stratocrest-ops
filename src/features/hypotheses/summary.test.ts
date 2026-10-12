import { describe, expect, it } from "vitest"
import { evidenceText, groupByStatus, newestFirst, summarizeEvidence } from "./summary"
import type { HypothesisStatus, TestOutcome } from "./types"

function test(
  test_date: string,
  outcome: TestOutcome,
  evidence = "x",
  created_at = "2026-10-01T12:00:00Z",
) {
  return { test_date, outcome, evidence, created_at }
}

describe("newestFirst", () => {
  it("orders by test date, then by when it was written down", () => {
    const tests = [
      test("2026-10-01", "supports", "a", "2026-10-01T10:00:00Z"),
      test("2026-10-05", "contradicts", "b", "2026-10-05T10:00:00Z"),
      test("2026-10-01", "inconclusive", "c", "2026-10-02T09:00:00Z"),
    ]
    expect(newestFirst(tests).map((t) => t.evidence)).toEqual(["b", "c", "a"])
  })

  it("doesn't change the list it was given", () => {
    const tests = [test("2026-10-01", "supports", "a"), test("2026-10-02", "supports", "b")]
    newestFirst(tests)
    expect(tests.map((t) => t.evidence)).toEqual(["a", "b"])
  })
})

describe("summarizeEvidence", () => {
  it("counts every outcome (zero included) and picks the latest test", () => {
    const summary = summarizeEvidence([
      test("2026-10-01", "supports", "first"),
      test("2026-10-07", "contradicts", "latest"),
      test("2026-10-03", "supports", "middle"),
    ])
    expect(summary.counts).toEqual({ supports: 2, contradicts: 1, inconclusive: 0 })
    expect(summary.total).toBe(3)
    expect(summary.latest).toEqual({
      testDate: "2026-10-07",
      outcome: "contradicts",
      evidence: "latest",
    })
  })

  it("has no latest test when there is no evidence", () => {
    expect(summarizeEvidence([])).toEqual({
      counts: { supports: 0, contradicts: 0, inconclusive: 0 },
      total: 0,
      latest: null,
    })
  })
})

describe("evidenceText", () => {
  const counts = (supports: number, contradicts: number, inconclusive: number) => ({
    counts: { supports, contradicts, inconclusive },
    total: supports + contradicts + inconclusive,
  })

  it("says when there's nothing yet", () => {
    expect(evidenceText(counts(0, 0, 0))).toBe("No evidence yet")
  })

  it("lists only the outcomes seen, with the right verb", () => {
    expect(evidenceText(counts(1, 0, 0))).toBe("1 supports")
    expect(evidenceText(counts(2, 1, 0))).toBe("2 support, 1 contradicts")
    expect(evidenceText(counts(0, 2, 3))).toBe("2 contradict, 3 inconclusive")
  })
})

describe("groupByStatus", () => {
  function item(id: string, status: HypothesisStatus, createdAt: string, latest?: string) {
    return {
      id,
      status,
      createdAt,
      evidence: {
        latest: latest ? { testDate: latest, outcome: "supports" as const, evidence: "" } : null,
      },
    }
  }

  it("returns the three sections in order, even when empty", () => {
    expect(groupByStatus([]).map((g) => [g.status, g.items.length])).toEqual([
      ["untested", 0],
      ["validated", 0],
      ["invalidated", 0],
    ])
  })

  it("puts the most recently tested first, then the newest", () => {
    const groups = groupByStatus([
      item("old-untested", "untested", "2026-09-01T00:00:00Z"),
      item("new-untested", "untested", "2026-10-01T00:00:00Z"),
      item("tested-untested", "untested", "2026-08-01T00:00:00Z", "2026-10-05"),
      item("validated", "validated", "2026-09-01T00:00:00Z", "2026-09-20"),
      item("invalidated", "invalidated", "2026-09-02T00:00:00Z"),
    ])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([
      ["tested-untested", "new-untested", "old-untested"],
      ["validated"],
      ["invalidated"],
    ])
  })
})
