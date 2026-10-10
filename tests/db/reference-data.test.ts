import { afterAll, describe, expect, test } from "vitest"
import {
  AVAILABILITY_LABELS,
  CANDIDATE_STAGES,
  CONTACT_METHODS,
  DEBRIEF_KINDS,
  DEBRIEF_STATUSES,
  HYPOTHESIS_DECISIONS,
  HYPOTHESIS_STATUSES,
  ORG_KINDS,
  ORG_REGIONS,
  ORG_SUBTYPES,
  SESSION_EMPHASES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEAM_MEETING_STATUSES,
  TEST_OUTCOMES,
  orgStagesByKind,
} from "@/lib/labels"
import { closeDb, rows, withTx } from "./helpers"

/**
 * The value lists in src/lib/labels.ts mirror the database. TypeScript checks
 * the enums against the generated types; these tests check the live database
 * (in case `pnpm db:types` wasn't run) and the org_stages table, which no type
 * covers.
 */

afterAll(closeDb)

describe("org_stages", () => {
  test("matches orgStagesByKind in labels.ts: same stages, labels, outcomes and order", async () => {
    await withTx(async (db) => {
      const stages = await rows<{
        kind: string
        stage: string
        label: string
        position: number
        outcome: string
      }>(
        db,
        "select kind, stage, label, position, outcome from public.org_stages order by kind, position",
      )

      for (const kind of ORG_KINDS) {
        const inDb = stages.filter((s) => s.kind === kind)
        expect(
          inDb.map((s) => s.position),
          kind,
        ).toEqual(inDb.map((_, i) => i + 1))
        expect(
          inDb.map(({ stage, label, outcome }) => ({ value: stage, label, outcome })),
          kind,
        ).toEqual(orgStagesByKind[kind])
      }
      expect(new Set(stages.map((s) => s.kind))).toEqual(new Set(ORG_KINDS))
    })
  })

  test("each pipeline has exactly one won and one lost stage, after the open ones", async () => {
    await withTx(async (db) => {
      const outcomes = await rows<{ kind: string; outcomes: string[] }>(
        db,
        "select kind, array_agg(outcome order by position) as outcomes from public.org_stages group by kind",
      )
      for (const { kind, outcomes: list } of outcomes) {
        const open = list.filter((o) => o === "open").length
        expect(list, kind).toEqual([...Array<string>(open).fill("open"), "won", "lost"])
      }
    })
  })
})

describe("enums", () => {
  const mirrors: Record<string, readonly string[]> = {
    availability_label: AVAILABILITY_LABELS,
    candidate_stage: CANDIDATE_STAGES,
    contact_method: CONTACT_METHODS,
    debrief_kind: DEBRIEF_KINDS,
    debrief_status: DEBRIEF_STATUSES,
    hypothesis_decision: HYPOTHESIS_DECISIONS,
    hypothesis_status: HYPOTHESIS_STATUSES,
    org_kind: ORG_KINDS,
    org_region: ORG_REGIONS,
    org_subtype: ORG_SUBTYPES,
    session_emphasis: SESSION_EMPHASES,
    task_priority: TASK_PRIORITIES,
    task_status: TASK_STATUSES,
    team_meeting_status: TEAM_MEETING_STATUSES,
    test_outcome: TEST_OUTCOMES,
  }

  test("every database enum value has a label list entry in labels.ts, and nothing extra", async () => {
    await withTx(async (db) => {
      const enums = await rows<{ name: string; values: string[] }>(
        db,
        `select t.typname::text as name, array_agg(e.enumlabel::text order by e.enumsortorder) as values
           from pg_type t join pg_enum e on e.enumtypid = t.oid
          where t.typnamespace = 'public'::regnamespace
          group by t.typname order by t.typname`,
      )
      // actor_kind is internal (person/bot) and has no UI list.
      expect(enums.map((e) => e.name).filter((n) => n !== "actor_kind")).toEqual(
        Object.keys(mirrors).sort(),
      )
      for (const { name, values } of enums) {
        if (name === "actor_kind") continue
        expect([...values].sort(), name).toEqual([...mirrors[name]].sort())
      }
    })
  })
})
