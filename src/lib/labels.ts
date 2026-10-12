import type { Database } from "@/types/database"

/**
 * Stored values (snake_case, stable for the bot API) and their display labels.
 * The value lists are checked against the database enums at compile time, and
 * org stages are checked against the `org_stages` table by the DB tests.
 */
type Enums = Database["public"]["Enums"]

/** Compile-time check that `values` lists every member of enum `E`, in any order. */
function enumValues<E extends string>() {
  return <const V extends readonly E[]>(values: V & ([E] extends [V[number]] ? unknown : never)) =>
    values
}

function labelOf<V extends string>(labels: Record<V, string>) {
  return (value: V) => labels[value]
}

export const ORG_KINDS = enumValues<Enums["org_kind"]>()(["investor", "customer"])
export const orgKindLabels: Record<Enums["org_kind"], { singular: string; plural: string }> = {
  investor: { singular: "Investor", plural: "Investors" },
  customer: { singular: "Customer", plural: "Customers" },
}

export const ORG_REGIONS = enumValues<Enums["org_region"]>()([
  "ohio",
  "midwest",
  "rest_of_us",
  "international",
])
export const orgRegionLabels: Record<Enums["org_region"], string> = {
  ohio: "Ohio",
  midwest: "Midwest",
  rest_of_us: "Rest of US",
  international: "International",
}

export const ORG_SUBTYPES = enumValues<Enums["org_subtype"]>()([
  "vc",
  "angel",
  "grant_program",
  "construction_firm",
  "hard_hat_manufacturer",
  "safety_distributor",
  "other",
])
export const orgSubtypeLabels: Record<Enums["org_subtype"], string> = {
  vc: "VC",
  angel: "Angel",
  grant_program: "Grant program",
  construction_firm: "Construction firm",
  hard_hat_manufacturer: "Hard hat manufacturer",
  safety_distributor: "Safety distributor",
  other: "Other",
}
/** Subtypes allowed per kind (mirrors the CHECK on organizations.subtype). */
export const orgSubtypesByKind = {
  investor: ["vc", "angel", "grant_program", "other"],
  customer: ["construction_firm", "hard_hat_manufacturer", "safety_distributor", "other"],
} as const satisfies Record<Enums["org_kind"], readonly Enums["org_subtype"][]>

/** Stages per kind, in pipeline order (mirrors the org_stages table). */
export const orgStagesByKind = {
  investor: [
    { value: "identified", label: "Identified", outcome: "open" },
    { value: "contacted", label: "Contacted", outcome: "open" },
    { value: "meeting", label: "Meeting", outcome: "open" },
    { value: "diligence", label: "Diligence", outcome: "open" },
    { value: "committed", label: "Committed", outcome: "won" },
    { value: "passed", label: "Passed", outcome: "lost" },
  ],
  customer: [
    { value: "identified", label: "Identified", outcome: "open" },
    { value: "contacted", label: "Contacted", outcome: "open" },
    { value: "discovery", label: "Discovery", outcome: "open" },
    { value: "pilot_proposed", label: "Pilot Proposed", outcome: "open" },
    { value: "pilot_active", label: "Pilot Active", outcome: "open" },
    { value: "converted", label: "Converted", outcome: "won" },
    { value: "lost", label: "Lost", outcome: "lost" },
  ],
} as const satisfies Record<
  Enums["org_kind"],
  readonly { value: string; label: string; outcome: "open" | "won" | "lost" }[]
>
export type OrgStage<K extends Enums["org_kind"] = Enums["org_kind"]> =
  (typeof orgStagesByKind)[K][number]["value"]

export function orgStageLabel(kind: Enums["org_kind"], stage: string): string {
  return orgStagesByKind[kind].find((s) => s.value === stage)?.label ?? stage
}

export const CONTACT_METHODS = enumValues<Enums["contact_method"]>()([
  "cold_email",
  "warm_intro",
  "synthe6_event",
  "conference",
  "other",
])
export const contactMethodLabels: Record<Enums["contact_method"], string> = {
  cold_email: "Cold email",
  warm_intro: "Warm intro",
  synthe6_event: "Synthe6 event",
  conference: "Conference",
  other: "Other",
}

export const HYPOTHESIS_STATUSES = enumValues<Enums["hypothesis_status"]>()([
  "untested",
  "validated",
  "invalidated",
])
export const hypothesisStatusLabels: Record<Enums["hypothesis_status"], string> = {
  untested: "Untested",
  validated: "Validated",
  invalidated: "Invalidated",
}

export const HYPOTHESIS_DECISIONS = enumValues<Enums["hypothesis_decision"]>()([
  "persevere",
  "pivot",
  "drop",
])
export const hypothesisDecisionLabels: Record<Enums["hypothesis_decision"], string> = {
  persevere: "Persevere",
  pivot: "Pivot",
  drop: "Drop",
}

export const TEST_OUTCOMES = enumValues<Enums["test_outcome"]>()([
  "supports",
  "contradicts",
  "inconclusive",
])
export const testOutcomeLabels: Record<Enums["test_outcome"], string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  inconclusive: "Inconclusive",
}

export const TASK_STATUSES = enumValues<Enums["task_status"]>()([
  "to_do",
  "in_progress",
  "blocked",
  "done",
])
export const taskStatusLabels: Record<Enums["task_status"], string> = {
  to_do: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
}

export const TASK_PRIORITIES = enumValues<Enums["task_priority"]>()(["low", "medium", "high"])
export const taskPriorityLabels: Record<Enums["task_priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

export const DEBRIEF_KINDS = enumValues<Enums["debrief_kind"]>()([
  "synthe6",
  "mentor",
  "investor",
  "customer",
  "team_meeting",
])
export const debriefKindLabels: Record<Enums["debrief_kind"], string> = {
  synthe6: "Synthe6 session",
  mentor: "Mentor coaching",
  investor: "Investor meeting",
  customer: "Customer meeting",
  team_meeting: "Sunday meeting",
}

export const DEBRIEF_STATUSES = enumValues<Enums["debrief_status"]>()(["due", "done"])
export const debriefStatusLabels: Record<Enums["debrief_status"], string> = {
  due: "Due",
  done: "Done",
}

export const AVAILABILITY_LABELS = enumValues<Enums["availability_label"]>()([
  "class",
  "work",
  "other",
])
export const availabilityLabelLabels: Record<Enums["availability_label"], string> = {
  class: "Class",
  work: "Work",
  other: "Other",
}

export const SESSION_EMPHASES = enumValues<Enums["session_emphasis"]>()([
  "okr_share_out",
  "mentor_coaching",
  "demo_day_prep",
])
export const sessionEmphasisLabels: Record<Enums["session_emphasis"], string> = {
  okr_share_out: "OKR share-out",
  mentor_coaching: "Mentor coaching",
  demo_day_prep: "Demo Day prep",
}

export const TEAM_MEETING_STATUSES = enumValues<Enums["team_meeting_status"]>()([
  "upcoming",
  "held",
  "canceled",
])
export const teamMeetingStatusLabels: Record<Enums["team_meeting_status"], string> = {
  upcoming: "Upcoming",
  held: "Held",
  canceled: "Canceled",
}

export const CANDIDATE_STAGES = enumValues<Enums["candidate_stage"]>()([
  "sourced",
  "intro_call",
  "trial_project",
  "offer",
  "joined",
  "passed",
])
export const candidateStageLabels: Record<Enums["candidate_stage"], string> = {
  sourced: "Sourced",
  intro_call: "Intro call",
  trial_project: "Trial project",
  offer: "Offer",
  joined: "Joined",
  passed: "Passed",
}

export const ACTOR_KIND_LABELS: Record<"person" | "bot" | "system", string> = {
  person: "Person",
  bot: "via Grok",
  system: "Automatic",
}

export const taskStatusLabel = labelOf(taskStatusLabels)
export const debriefKindLabel = labelOf(debriefKindLabels)
