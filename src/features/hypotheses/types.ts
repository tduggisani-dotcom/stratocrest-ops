import type { OrgKind } from "@/features/orgs/kind-config"
import type { FormState } from "@/lib/forms"
import type { IsoDate } from "@/lib/dates"
import type { Database } from "@/types/database"

/**
 * Shapes the hypothesis reads and Server Actions share with the components.
 * Kept out of actions.ts because a "use server" file may only export async
 * functions.
 */

type Enums = Database["public"]["Enums"]
export type HypothesisStatus = Enums["hypothesis_status"]
export type HypothesisDecision = Enums["hypothesis_decision"]
export type TestOutcome = Enums["test_outcome"]

/** Status, archive and restore: called from buttons, not forms. */
export type HypothesisActionResult = { status: "success" } | { status: "error"; message: string }

export const initialHypothesisFormState: FormState = { status: "idle" }

export type HypothesisPerson = { id: string; name: string; avatarUrl: string | null }

/** The investor or customer a hypothesis is about. */
export type HypothesisOrg = { id: string; name: string; kind: OrgKind; archived: boolean }

/** One test: what a conversation showed. */
export type EvidenceEntry = {
  id: string
  testDate: IsoDate
  outcome: TestOutcome
  evidence: string
  createdAt: string
  /** The investor or customer meeting it came from. */
  meeting: { id: string; startsAt: string; org: { id: string; name: string; kind: OrgKind } } | null
}

/** How many tests showed what, and the most recent one. */
export type EvidenceSummary = {
  counts: Record<TestOutcome, number>
  total: number
  latest: Pick<EvidenceEntry, "testDate" | "outcome" | "evidence"> | null
}

/** A hypothesis in a list (the org page, the roll-up). */
export type HypothesisListItem = {
  id: string
  statement: string
  status: HypothesisStatus
  decision: HypothesisDecision | null
  /** Investors or customers; null only for an old record nobody classified. */
  audience: OrgKind | null
  org: HypothesisOrg | null
  owner: HypothesisPerson | null
  evidence: EvidenceSummary
  archived: boolean
  createdAt: string
}

/** One hypothesis with everything its page shows. */
export type HypothesisDetail = HypothesisListItem & {
  testPlan: string | null
  successCriterion: string | null
  result: string | null
  learning: string | null
  /** Newest first. */
  tests: EvidenceEntry[]
  updatedAt: string
}

/** A meeting the evidence form can link to. */
export type MeetingOption = { id: string; label: string }

/** An org the hypothesis form can link to. */
export type OrgOption = { id: string; name: string; kind: OrgKind }
