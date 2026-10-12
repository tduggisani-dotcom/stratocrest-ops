import { beforeEach, describe, expect, it, vi } from "vitest"
import { orgKindMessages, ORG_MESSAGES } from "@/lib/schemas/organizations"

/**
 * The org Server Actions against a fake Supabase client: what they validate,
 * what they write, and how they explain a failure. (The real rules are also
 * enforced by the database; see the psql checks in the Stage 3 notes.)
 */

type DbError = { code?: string; message: string }
type Result = { data: unknown; error: DbError | null; count?: number }
type Call = { table: string; ops: [string, unknown[]][] }

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
  for (const op of ["select", "insert", "update", "eq", "is", "not", "neq", "in", "order"]) {
    chain[op] = (...args: unknown[]) => {
      call.ops.push([op, args])
      return chain
    }
  }
  chain.single = () => {
    call.ops.push(["single", []])
    return run()
  }
  chain.maybeSingle = () => {
    call.ops.push(["maybeSingle", []])
    return run()
  }
  chain.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    run().then(resolve, reject)
  return chain
}

vi.mock("@/lib/auth", () => ({ requireTeamMember: vi.fn(async () => ({ id: "me" })) }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: (table: string) => builder(table) })),
}))
vi.mock("next/cache", () => ({ refresh: vi.fn() }))

const { createOrg, updateOrg, archiveOrg, restoreOrg } = await import("./actions")
const { changeOrgStage } = await import("./stage-actions")
const { refresh } = await import("next/cache")

const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const OTHER = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const filled = {
  name: "Example Seed Fund",
  subtype: "",
  owner_id: OWNER,
  next_step: "Send the deck",
  next_step_date: "2026-10-20",
  contact_email: "",
  related_organization_id: "",
}

const idle = { status: "idle" as const }

/** The ops of the first call that used `op` on `table`. */
function opsOf(table: string, op: string) {
  const call = state.calls.find((c) => c.table === table && c.ops.some(([name]) => name === op))
  return call?.ops.find(([name]) => name === op)?.[1]
}

beforeEach(() => {
  state.calls = []
  state.respond = () => ({ data: null, error: null })
  vi.mocked(refresh).mockClear()
})

describe("createOrg", () => {
  it("refuses a form without a valid kind", async () => {
    const result = await createOrg(idle, form({ ...filled, kind: "partner" }))
    expect(result).toMatchObject({ status: "error", values: { kind: "partner" } })
    expect(state.calls).toHaveLength(0)
  })

  it("explains missing required fields without writing", async () => {
    const result = await createOrg(idle, form({ kind: "customer", name: " " }))
    expect(result.status).toBe("error")
    expect(result.fieldErrors).toEqual({
      name: orgKindMessages("customer").name,
      owner_id: ORG_MESSAGES.owner,
      next_step: ORG_MESSAGES.nextStep,
      next_step_date: ORG_MESSAGES.nextStepDate,
    })
    expect(state.calls).toHaveLength(0)
  })

  it("inserts the kind with the validated fields and refreshes", async () => {
    state.respond = () => ({ data: { id: ORG }, error: null })
    const result = await createOrg(idle, form({ ...filled, kind: "investor" }))
    expect(result).toEqual({ status: "success", id: ORG })
    expect(opsOf("organizations", "insert")?.[0]).toEqual({
      kind: "investor",
      name: "Example Seed Fund",
      stage: "identified",
      owner_id: OWNER,
      next_step: "Send the deck",
      next_step_date: "2026-10-20",
    })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("points at the existing record when the name is taken", async () => {
    state.respond = (call) => {
      if (call.ops.some(([op]) => op === "insert")) {
        return { data: null, error: { code: "23505", message: "duplicate" } }
      }
      return { data: [{ id: OTHER, name: "EXAMPLE seed fund" }], error: null }
    }
    const result = await createOrg(idle, form({ ...filled, kind: "investor" }))
    expect(result).toMatchObject({
      status: "error",
      fieldErrors: { name: "There's already an investor called EXAMPLE seed fund." },
      duplicate: { id: OTHER, name: "EXAMPLE seed fund" },
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it("only links a record of the other kind", async () => {
    state.respond = () => ({ data: { kind: "investor" }, error: null })
    const result = await createOrg(
      idle,
      form({ ...filled, kind: "investor", related_organization_id: OTHER }),
    )
    expect(result.fieldErrors).toEqual({
      related_organization_id: orgKindMessages("investor").relatedOrg,
    })
    expect(opsOf("organizations", "insert")).toBeUndefined()
  })
})

describe("updateOrg", () => {
  it("validates against the org's kind from the database", async () => {
    state.respond = () => ({ data: { kind: "customer", archived_at: null }, error: null })
    const result = await updateOrg(idle, form({ ...filled, id: ORG, stage: "diligence" }))
    expect(result.fieldErrors).toEqual({ stage: orgKindMessages("customer").stage })
    expect(opsOf("organizations", "update")).toBeUndefined()
  })

  it("refuses to edit an archived org", async () => {
    state.respond = () => ({ data: { kind: "investor", archived_at: "2026-10-01" }, error: null })
    const result = await updateOrg(idle, form({ ...filled, id: ORG, stage: "meeting" }))
    expect(result).toMatchObject({ status: "error", message: orgKindMessages("investor").archived })
  })

  it("writes every sent field (blank ones cleared) but never the id", async () => {
    state.respond = (call) =>
      call.ops.some(([op]) => op === "update")
        ? { data: { id: ORG }, error: null }
        : { data: { kind: "investor", archived_at: null }, error: null }
    const result = await updateOrg(idle, form({ ...filled, id: ORG, stage: "meeting" }))
    expect(result).toEqual({ status: "success", id: ORG })
    expect(opsOf("organizations", "update")?.[0]).toEqual({
      name: "Example Seed Fund",
      subtype: null,
      stage: "meeting",
      owner_id: OWNER,
      next_step: "Send the deck",
      next_step_date: "2026-10-20",
      contact_email: null,
      related_organization_id: null,
    })
    expect(refresh).toHaveBeenCalledOnce()
  })
})

describe("changeOrgStage", () => {
  it("refuses a stage of the other kind", async () => {
    state.respond = () => ({
      data: { kind: "investor", stage: "meeting", archived_at: null },
      error: null,
    })
    expect(await changeOrgStage(ORG, "pilot_active")).toEqual({
      status: "error",
      message: orgKindMessages("investor").stage,
    })
    expect(opsOf("organizations", "update")).toBeUndefined()
  })

  it("does nothing when the stage is already set", async () => {
    state.respond = () => ({
      data: { kind: "investor", stage: "meeting", archived_at: null },
      error: null,
    })
    expect(await changeOrgStage(ORG, "meeting")).toEqual({ status: "success" })
    expect(opsOf("organizations", "update")).toBeUndefined()
  })

  it("moves the org and refreshes", async () => {
    state.respond = (call) =>
      call.ops.some(([op]) => op === "update")
        ? { data: { id: ORG }, error: null }
        : { data: { kind: "customer", stage: "discovery", archived_at: null }, error: null }
    expect(await changeOrgStage(ORG, "pilot_proposed")).toEqual({ status: "success" })
    expect(opsOf("organizations", "update")?.[0]).toEqual({ stage: "pilot_proposed" })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("refuses archived orgs and malformed ids", async () => {
    state.respond = () => ({
      data: { kind: "investor", stage: "meeting", archived_at: "2026-10-01" },
      error: null,
    })
    expect(await changeOrgStage(ORG, "diligence")).toMatchObject({ status: "error" })
    expect((await changeOrgStage("nope", "diligence")).status).toBe("error")
  })
})

describe("archiveOrg / restoreOrg", () => {
  it("archives an active org", async () => {
    state.respond = (call) =>
      call.ops.some(([op]) => op === "update")
        ? { data: { id: ORG }, error: null }
        : { data: { kind: "investor", name: "Example Seed Fund" }, error: null }
    expect(await archiveOrg(ORG)).toEqual({ status: "success" })
    const update = opsOf("organizations", "update")?.[0] as { archived_at: string }
    expect(update.archived_at).toEqual(expect.any(String))
  })

  it("explains a restore blocked by an active namesake", async () => {
    state.respond = (call) =>
      call.ops.some(([op]) => op === "update")
        ? { data: null, error: { code: "23505", message: "duplicate" } }
        : { data: { kind: "customer", name: "Acme" }, error: null }
    expect(await restoreOrg(ORG)).toEqual({
      status: "error",
      message: "There's already a customer called Acme. Rename one of them, then restore this one.",
    })
  })
})
