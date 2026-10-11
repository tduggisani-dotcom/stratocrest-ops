import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { OwnedKeyResult } from "@/features/people/queries"
import { OwnershipSection } from "./ownership-section"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const PERSON_ID = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"

function keyResult(values: Partial<OwnedKeyResult>): OwnedKeyResult {
  return {
    id: "kr1",
    title: "Hold customer discovery meetings",
    objectiveTitle: "Validate the market",
    quarterLabel: "Q1",
    startValue: 0,
    currentValue: 0,
    targetValue: 1000,
    unit: "meetings",
    ...values,
  }
}

function render(keyResults: OwnedKeyResult[]) {
  return renderToStaticMarkup(
    <OwnershipSection
      personId={PERSON_ID}
      name="Sam Browning"
      orgs={[]}
      keyResults={keyResults}
      openTasks={[]}
      today="2026-10-11"
    />,
  )
}

describe("OwnershipSection key results", () => {
  it("uses the same percent as This Week: 100 only once the target is reached", () => {
    const almost = render([keyResult({ currentValue: 996 })])
    expect(almost).toContain("996 of 1,000 meetings · 99%")
    expect(almost).toContain("width:99%")
    expect(almost).not.toContain("bg-good")

    const started = render([keyResult({ currentValue: 4 })])
    expect(started).toContain("4 of 1,000 meetings · 1%")
    expect(started).toContain("width:1%")

    // A target below the start ("cut cost per liner from $12 to $8").
    const cost = render([
      keyResult({ startValue: 12, currentValue: 8.01, targetValue: 8, unit: "$" }),
    ])
    expect(cost).toContain("$8.01 of $8 · 99%")
  })

  it("shows a reached target as 100%, in green", () => {
    const done = render([keyResult({ currentValue: 1000 })])
    expect(done).toContain("1,000 of 1,000 meetings · 100%")
    expect(done).toContain("width:100%")
    expect(done).toContain("bg-good")
  })
})
