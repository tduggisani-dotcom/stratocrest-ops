import { describe, expect, it } from "vitest"
import {
  ACTOR_KIND_LABELS,
  AVAILABILITY_LABELS,
  availabilityLabelLabels,
  CANDIDATE_STAGES,
  candidateStageLabels,
  CONTACT_METHODS,
  contactMethodLabels,
  DEBRIEF_KINDS,
  DEBRIEF_STATUSES,
  debriefKindLabel,
  debriefKindLabels,
  debriefStatusLabels,
  HYPOTHESIS_DECISIONS,
  HYPOTHESIS_STATUSES,
  hypothesisDecisionLabels,
  hypothesisStatusLabels,
  ORG_KINDS,
  ORG_REGIONS,
  ORG_SUBTYPES,
  orgKindLabels,
  orgRegionLabels,
  orgStageLabel,
  orgStagesByKind,
  orgSubtypeLabels,
  orgSubtypesByKind,
  SESSION_EMPHASES,
  sessionEmphasisLabels,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskPriorityLabels,
  taskStatusLabel,
  taskStatusLabels,
  TEAM_MEETING_STATUSES,
  teamMeetingStatusLabels,
  TEST_OUTCOMES,
  testOutcomeLabels,
} from "@/lib/labels"
import { Constants } from "@/types/database"

const dbEnums = Constants.public.Enums
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

// [database enum, value list, labels]
const enumTable = [
  ["org_kind", ORG_KINDS, orgKindLabels],
  ["org_region", ORG_REGIONS, orgRegionLabels],
  ["org_subtype", ORG_SUBTYPES, orgSubtypeLabels],
  ["contact_method", CONTACT_METHODS, contactMethodLabels],
  ["hypothesis_status", HYPOTHESIS_STATUSES, hypothesisStatusLabels],
  ["hypothesis_decision", HYPOTHESIS_DECISIONS, hypothesisDecisionLabels],
  ["test_outcome", TEST_OUTCOMES, testOutcomeLabels],
  ["task_status", TASK_STATUSES, taskStatusLabels],
  ["task_priority", TASK_PRIORITIES, taskPriorityLabels],
  ["debrief_kind", DEBRIEF_KINDS, debriefKindLabels],
  ["debrief_status", DEBRIEF_STATUSES, debriefStatusLabels],
  ["availability_label", AVAILABILITY_LABELS, availabilityLabelLabels],
  ["session_emphasis", SESSION_EMPHASES, sessionEmphasisLabels],
  ["team_meeting_status", TEAM_MEETING_STATUSES, teamMeetingStatusLabels],
  ["candidate_stage", CANDIDATE_STAGES, candidateStageLabels],
] as const satisfies readonly (readonly [
  keyof typeof dbEnums,
  readonly string[],
  Record<string, unknown>,
])[]

function labelText(label: unknown): string[] {
  if (typeof label === "string") return [label]
  return Object.values(label as Record<string, string>)
}

describe("enum value lists", () => {
  it.each(enumTable)("%s lists exactly the database values", (name, values) => {
    expect([...values].sort()).toEqual([...dbEnums[name]].sort())
    expect(new Set(values).size).toBe(values.length)
  })

  it.each(enumTable)("%s values are snake_case", (_name, values) => {
    for (const value of values) expect(value).toMatch(SNAKE_CASE)
  })

  it.each(enumTable)("%s has a non-empty label for every value, and no extras", (_n, v, labels) => {
    expect(Object.keys(labels).sort()).toEqual([...v].sort())
    for (const label of Object.values(labels)) {
      for (const text of labelText(label)) expect(text.trim()).not.toBe("")
    }
  })

  it("covers every database enum except actor_kind (labelled separately)", () => {
    const covered = enumTable.map(([name]) => name).sort()
    const expected = Object.keys(dbEnums)
      .filter((name) => name !== "actor_kind")
      .sort()
    expect(covered).toEqual(expected)
  })
})

describe("org stages", () => {
  it("lists investor stages in pipeline order", () => {
    expect(orgStagesByKind.investor.map((s) => s.value)).toEqual([
      "identified",
      "contacted",
      "meeting",
      "diligence",
      "committed",
      "passed",
    ])
  })

  it("lists customer stages in pipeline order", () => {
    expect(orgStagesByKind.customer.map((s) => s.value)).toEqual([
      "identified",
      "contacted",
      "discovery",
      "pilot_proposed",
      "pilot_active",
      "converted",
      "lost",
    ])
  })

  it.each(ORG_KINDS)("%s: open stages first, then one won and one lost", (kind) => {
    const outcomes = orgStagesByKind[kind].map((s) => s.outcome)
    expect(outcomes.slice(-2)).toEqual(["won", "lost"])
    expect(outcomes.slice(0, -2).every((outcome) => outcome === "open")).toBe(true)
  })

  it.each(ORG_KINDS)("%s: every stage has a label and a snake_case value", (kind) => {
    for (const stage of orgStagesByKind[kind]) {
      expect(stage.value).toMatch(SNAKE_CASE)
      expect(stage.label.trim()).not.toBe("")
    }
  })

  it("labels a stage, and falls back to the raw value", () => {
    expect(orgStageLabel("customer", "pilot_proposed")).toBe("Pilot Proposed")
    expect(orgStageLabel("investor", "diligence")).toBe("Diligence")
    expect(orgStageLabel("investor", "pilot_active")).toBe("pilot_active")
  })
})

describe("org subtypes by kind", () => {
  it.each(ORG_KINDS)("%s subtypes are known values and include other", (kind) => {
    for (const subtype of orgSubtypesByKind[kind]) expect(ORG_SUBTYPES).toContain(subtype)
    expect(orgSubtypesByKind[kind]).toContain("other")
  })

  it("covers every subtype between the two kinds", () => {
    const all = new Set([...orgSubtypesByKind.investor, ...orgSubtypesByKind.customer])
    expect([...all].sort()).toEqual([...ORG_SUBTYPES].sort())
  })
})

describe("label helpers", () => {
  it("label single values", () => {
    expect(taskStatusLabel("in_progress")).toBe("In Progress")
    expect(debriefKindLabel("team_meeting")).toBe("Sunday meeting")
  })

  it("shows bot changes as via Grok", () => {
    expect(ACTOR_KIND_LABELS).toEqual({ person: "Person", bot: "via Grok", system: "Automatic" })
  })
})
