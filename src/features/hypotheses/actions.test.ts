import { beforeEach, describe, expect, it, vi } from "vitest"
import { HYPOTHESIS_MESSAGES } from "@/lib/schemas/hypotheses"

/**
 * The hypothesis Server Actions against a fake Supabase client: what they
 * validate, what they write, and how they explain a failure. The database
 * enforces the same rules (see the psql checks in the Stage 3 notes).
 */

type DbError = { code?: string; message: string }
type Op = [string, unknown[]]
type Call = { table: string; ops: Op[] }
type Response = { data: unknown; error: DbError | null }

const state = vi.hoisted(() => ({
  calls: [] as { table: string; ops: [string, unknown[]][] }[],
  respond: (() => ({ data: null, error: null })) as (call: {
    table: string
    ops: [string, unknown[]][]
  }) => { data: unknown; error: { code?: string; message: string } | null },
}))

function builder(table: string) {
  const call: Call = { table, ops: [] }
  state.calls.push(call)
  const run = () => Promise.resolve(state.respond(call))
  const chain: Record<string, unknown> = {}
  for (const op of ["select", "insert", "update", "eq", "is", "not", "in", "order", "limit"]) {
    chain[op] = (...args: unknown[]) => {
      call.ops.push([op, args])
      return chain
    }
  }
  for (const op of ["single", "maybeSingle"]) {
    chain[op] = () => {
      call.ops.push([op, []])
      return run()
    }
  }
  chain.then = (resolve: (r: Response) => unknown, reject: (e: unknown) => unknown) =>
    run().then(resolve, reject)
  return chain
}

vi.mock("@/lib/auth", () => ({ requireTeamMember: vi.fn(async () => ({ id: "me" })) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: (table: string) => builder(table) })),
}))
vi.mock("next/cache", () => ({ refresh: vi.fn() }))

const {
  addHypothesisTest,
  archiveHypothesis,
  createHypothesis,
  restoreHypothesis,
  setHypothesisStatus,
  updateHypothesis,
  updateHypothesisTest,
} = await import("./actions")
const { refresh } = await import("next/cache")

const ME = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const OTHER_ORG = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"
const HYPOTHESIS = "3c4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b"
const TEST = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"
const MEETING = "5d6e7f80-1a2b-4c3d-9e4f-5a6b7c8d9e0f"

const idle = { status: "idle" as const }

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const has = (call: Call, op: string) => call.ops.some(([name]) => name === op)

/** The arguments of `op` in the first call to `table` that used it. */
function argsOf(table: string, op: string): unknown[] | undefined {
  const call = state.calls.find((c) => c.table === table && has(c, op))
  return call?.ops.find(([name]) => name === op)?.[1]
}

/** Answers reads with `reads[table]` and writes with `write`. */
function respondWith(
  reads: Partial<Record<string, unknown>>,
  write: Response = { data: { id: "new-id" }, error: null },
) {
  state.respond = (call) =>
    has(call, "insert") || has(call, "update")
      ? write
      : { data: reads[call.table] ?? null, error: null }
}

beforeEach(() => {
  state.calls = []
  state.respond = () => ({ data: null, error: null })
  vi.mocked(refresh).mockClear()
})

describe("createHypothesis", () => {
  it("asks for the statement and who it's about, without writing", async () => {
    const result = await createHypothesis(idle, form({ statement: " ", about: "" }))
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        statement: HYPOTHESIS_MESSAGES.statement,
        audience: HYPOTHESIS_MESSAGES.audience,
      },
      values: { statement: " ", about: "" },
    })
    expect(state.calls).toHaveLength(0)
  })

  it("adds one about an org without sending an audience (the database copies it)", async () => {
    respondWith({ organizations: { kind: "customer", archived_at: null } })
    const result = await createHypothesis(
      idle,
      form({ statement: "  Site managers will pay  ", organization_id: ORG, owner_id: ME }),
    )
    expect(result).toEqual({ status: "success", id: "new-id", message: "Hypothesis added" })
    expect(argsOf("hypotheses", "insert")?.[0]).toEqual({
      statement: "Site managers will pay",
      owner_id: ME,
      status: "untested",
      organization_id: ORG,
    })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("adds one across many with its audience", async () => {
    respondWith({})
    await createHypothesis(idle, form({ statement: "S", about: "investor", test_plan: "" }))
    expect(argsOf("hypotheses", "insert")?.[0]).toEqual({
      statement: "S",
      test_plan: null,
      status: "untested",
      organization_id: null,
      audience: "investor",
    })
  })

  it("refuses an archived or missing org", async () => {
    respondWith({ organizations: { kind: "investor", archived_at: "2026-10-01T00:00:00Z" } })
    const archived = await createHypothesis(idle, form({ statement: "S", organization_id: ORG }))
    expect(archived).toMatchObject({
      status: "error",
      fieldErrors: {
        organization_id: "That investor is archived. Restore it first, or choose another.",
      },
    })

    respondWith({})
    const missing = await createHypothesis(idle, form({ statement: "S", about: ORG }))
    expect(missing).toMatchObject({
      fieldErrors: { organization_id: HYPOTHESIS_MESSAGES.organization },
    })
    expect(state.calls.some((c) => has(c, "insert"))).toBe(false)
  })

  it("explains a database failure and keeps what was typed", async () => {
    respondWith({}, { data: null, error: { code: "42501", message: "rls" } })
    const result = await createHypothesis(idle, form({ statement: "S", about: "customer" }))
    expect(result).toMatchObject({
      status: "error",
      message: "You don't have access to do that. Try signing in again.",
      values: { statement: "S", about: "customer" },
    })
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe("updateHypothesis", () => {
  const current = { organization_id: ORG, audience: "customer", archived_at: null }

  it("saves the edit form's fields and moves it to many investors", async () => {
    respondWith({ hypotheses: current })
    const result = await updateHypothesis(
      idle,
      form({
        id: HYPOTHESIS,
        statement: "S",
        about: "investor",
        owner_id: "",
        result: "R",
        learning: "",
        decision: "pivot",
      }),
    )
    expect(result).toEqual({ status: "success", id: HYPOTHESIS, message: "Changes saved" })
    expect(argsOf("hypotheses", "update")?.[0]).toEqual({
      statement: "S",
      owner_id: null,
      result: "R",
      learning: null,
      decision: "pivot",
      organization_id: null,
      audience: "investor",
    })
    expect(argsOf("hypotheses", "is")).toEqual(["archived_at", null])
  })

  it("keeps a link to an org that was archived since", async () => {
    state.respond = (call) => {
      if (call.table === "organizations") {
        return { data: { kind: "customer", archived_at: "2026-10-01T00:00:00Z" }, error: null }
      }
      if (has(call, "update")) return { data: { id: HYPOTHESIS }, error: null }
      return { data: current, error: null }
    }
    const result = await updateHypothesis(
      idle,
      form({ id: HYPOTHESIS, statement: "S", about: ORG }),
    )
    expect(result.status).toBe("success")
    expect(argsOf("hypotheses", "update")?.[0]).toEqual({ statement: "S", organization_id: ORG })
    expect(state.calls.some((c) => c.table === "organizations")).toBe(false)
  })

  it("refuses to link a different archived org", async () => {
    state.respond = (call) =>
      call.table === "organizations"
        ? { data: { kind: "customer", archived_at: "2026-10-01T00:00:00Z" }, error: null }
        : { data: current, error: null }
    const result = await updateHypothesis(
      idle,
      form({ id: HYPOTHESIS, statement: "S", about: OTHER_ORG }),
    )
    expect(result.fieldErrors?.organization_id).toContain("archived")
  })

  it("refuses an archived hypothesis and an unknown one", async () => {
    respondWith({ hypotheses: { ...current, archived_at: "2026-10-01T00:00:00Z" } })
    const archived = await updateHypothesis(idle, form({ id: HYPOTHESIS, statement: "S" }))
    expect(archived).toMatchObject({
      status: "error",
      message: expect.stringContaining("archived"),
    })

    respondWith({})
    const missing = await updateHypothesis(idle, form({ id: HYPOTHESIS, statement: "S" }))
    expect(missing).toMatchObject({ message: HYPOTHESIS_MESSAGES.hypothesis })
    expect(state.calls.some((c) => has(c, "update"))).toBe(false)
  })

  it("says so when the hypothesis was archived while the form was open", async () => {
    respondWith({ hypotheses: current }, { data: null, error: null })
    const result = await updateHypothesis(idle, form({ id: HYPOTHESIS, statement: "S" }))
    expect(result.message).toContain("archived or no longer exists")
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe("setHypothesisStatus", () => {
  it("rejects an unknown status", async () => {
    const result = await setHypothesisStatus(HYPOTHESIS, "maybe" as "validated")
    expect(result).toEqual({ status: "error", message: HYPOTHESIS_MESSAGES.status })
    expect(state.calls).toHaveLength(0)
  })

  it("saves only on an active hypothesis", async () => {
    respondWith({}, { data: { id: HYPOTHESIS }, error: null })
    expect(await setHypothesisStatus(HYPOTHESIS, "validated")).toEqual({ status: "success" })
    expect(argsOf("hypotheses", "update")?.[0]).toEqual({ status: "validated" })
    expect(argsOf("hypotheses", "is")).toEqual(["archived_at", null])
    expect(refresh).toHaveBeenCalledOnce()

    respondWith({}, { data: null, error: null })
    const gone = await setHypothesisStatus(HYPOTHESIS, "invalidated")
    expect(gone).toMatchObject({ status: "error" })
  })
})

describe("archive and restore", () => {
  it("archives an active hypothesis", async () => {
    respondWith({}, { data: { id: HYPOTHESIS }, error: null })
    expect(await archiveHypothesis(HYPOTHESIS)).toEqual({ status: "success" })
    const [update] = argsOf("hypotheses", "update") as [{ archived_at: string }]
    expect(Date.parse(update.archived_at)).not.toBeNaN()
    expect(argsOf("hypotheses", "is")).toEqual(["archived_at", null])
  })

  it("restores an archived one", async () => {
    respondWith({}, { data: { id: HYPOTHESIS }, error: null })
    expect(await restoreHypothesis(HYPOTHESIS)).toEqual({ status: "success" })
    expect(argsOf("hypotheses", "update")?.[0]).toEqual({ archived_at: null })
    expect(argsOf("hypotheses", "not")).toEqual(["archived_at", "is", null])
  })

  it("explains when there was nothing to do, and rejects a malformed id", async () => {
    respondWith({}, { data: null, error: null })
    expect(await archiveHypothesis(HYPOTHESIS)).toMatchObject({
      message: expect.stringContaining("already archived"),
    })
    expect(await restoreHypothesis("nope")).toEqual({
      status: "error",
      message: HYPOTHESIS_MESSAGES.hypothesis,
    })
  })
})

describe("addHypothesisTest", () => {
  const evidence = {
    hypothesis_id: HYPOTHESIS,
    test_date: "2026-10-12",
    outcome: "supports",
    evidence: "They asked for a price",
  }

  it("asks for the outcome and the evidence", async () => {
    const result = await addHypothesisTest(
      idle,
      form({ hypothesis_id: HYPOTHESIS, test_date: "2026-10-12" }),
    )
    expect(result.fieldErrors).toEqual({
      outcome: HYPOTHESIS_MESSAGES.outcome,
      evidence: HYPOTHESIS_MESSAGES.evidence,
    })
    expect(state.calls).toHaveLength(0)
  })

  it("adds evidence from a meeting with the hypothesis's org", async () => {
    respondWith(
      {
        hypotheses: { organization_id: ORG, audience: "customer", archived_at: null },
        org_meetings: { organization_id: ORG, organization: { kind: "customer" } },
      },
      { data: { id: TEST }, error: null },
    )
    const result = await addHypothesisTest(idle, form({ ...evidence, org_meeting_id: MEETING }))
    expect(result).toEqual({ status: "success", id: TEST, message: "Evidence added" })
    expect(argsOf("hypothesis_tests", "insert")?.[0]).toEqual({
      ...evidence,
      org_meeting_id: MEETING,
    })
  })

  it("refuses a meeting with another org, or another audience for one across many", async () => {
    respondWith({
      hypotheses: { organization_id: ORG, audience: "customer", archived_at: null },
      org_meetings: { organization_id: OTHER_ORG, organization: { kind: "customer" } },
    })
    const otherOrg = await addHypothesisTest(idle, form({ ...evidence, org_meeting_id: MEETING }))
    expect(otherOrg.fieldErrors).toEqual({ org_meeting_id: HYPOTHESIS_MESSAGES.meeting })

    respondWith({
      hypotheses: { organization_id: null, audience: "investor", archived_at: null },
      org_meetings: { organization_id: OTHER_ORG, organization: { kind: "customer" } },
    })
    const otherKind = await addHypothesisTest(idle, form({ ...evidence, org_meeting_id: MEETING }))
    expect(otherKind.fieldErrors).toEqual({ org_meeting_id: HYPOTHESIS_MESSAGES.meeting })
    expect(state.calls.some((c) => has(c, "insert"))).toBe(false)
  })

  it("refuses evidence for an archived hypothesis", async () => {
    respondWith({
      hypotheses: { organization_id: ORG, audience: "customer", archived_at: "2026-10-01" },
    })
    const result = await addHypothesisTest(idle, form(evidence))
    expect(result.message).toContain("archived")
  })
})

describe("updateHypothesisTest", () => {
  it("corrects a piece of evidence", async () => {
    respondWith(
      {
        hypothesis_tests: { hypothesis_id: HYPOTHESIS },
        hypotheses: { organization_id: ORG, audience: "customer", archived_at: null },
      },
      { data: { id: TEST }, error: null },
    )
    const result = await updateHypothesisTest(
      idle,
      form({
        id: TEST,
        test_date: "2026-10-10",
        outcome: "inconclusive",
        evidence: "Mixed",
        org_meeting_id: "",
      }),
    )
    expect(result).toEqual({ status: "success", id: TEST, message: "Evidence updated" })
    expect(argsOf("hypothesis_tests", "update")?.[0]).toEqual({
      test_date: "2026-10-10",
      outcome: "inconclusive",
      evidence: "Mixed",
      org_meeting_id: null,
    })
  })

  it("explains when the evidence is gone", async () => {
    respondWith({})
    const result = await updateHypothesisTest(
      idle,
      form({ id: TEST, test_date: "2026-10-10", outcome: "supports", evidence: "E" }),
    )
    expect(result).toMatchObject({ status: "error", message: HYPOTHESIS_MESSAGES.test })
  })
})
