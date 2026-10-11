import { describe, expect, it } from "vitest"
import { TASK_LINK_FIELDS, taskInputSchema, taskUpdateSchema } from "@/lib/schemas/tasks"
import { readTaskForm } from "./form-data"

const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const TASK = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"

function form(entries: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

const filled = {
  title: " Send the deck ",
  next_action: "Email Jane",
  owner_id: OWNER,
  due_date: "2026-10-14",
  priority: "high",
  notes: "",
  organization_id: ORG,
  synthe6_session_id: "",
  key_result_id: "",
  team_meeting_id: "",
  org_meeting_id: "",
}

describe("readTaskForm (create)", () => {
  it("turns empty fields into undefined, so they are simply not set", () => {
    const input = readTaskForm(form(filled), "create")
    expect(input).toMatchObject({ title: "Send the deck", organization_id: ORG, priority: "high" })
    expect(input.notes).toBeUndefined()
    expect(input.synthe6_session_id).toBeUndefined()
    expect(input).not.toHaveProperty("id")

    const parsed = taskInputSchema.parse(input)
    expect(parsed.status).toBe("to_do")
    expect(Object.keys(JSON.parse(JSON.stringify(parsed))).sort()).toEqual(
      [
        "title",
        "next_action",
        "owner_id",
        "due_date",
        "status",
        "priority",
        "organization_id",
      ].sort(),
    )
  })

  it("leaves a blank required field missing, so the schema explains it", () => {
    const result = taskInputSchema.safeParse(
      readTaskForm(form({ ...filled, next_action: "   " }), "create"),
    )
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path.join("."))).toEqual(["next_action"])
  })

  it("ignores fields the form doesn't own (e.g. a forged created_by)", () => {
    const input = readTaskForm(form({ ...filled, created_by: OWNER, archived_at: "x" }), "create")
    expect(input).not.toHaveProperty("created_by")
    expect(input).not.toHaveProperty("archived_at")
  })
})

describe("readTaskForm (update)", () => {
  it("turns an emptied link or note into null, which clears it", () => {
    const input = readTaskForm(form({ ...filled, id: TASK, status: "done" }), "update")
    expect(input.id).toBe(TASK)
    expect(input.notes).toBeNull()
    for (const field of TASK_LINK_FIELDS) {
      expect(input[field]).toBe(field === "organization_id" ? ORG : null)
    }
    const parsed = taskUpdateSchema.parse(input)
    expect(parsed).toMatchObject({ id: TASK, status: "done", notes: null, key_result_id: null })
  })

  it("reads a missing id as undefined (the schema then rejects it)", () => {
    const input = readTaskForm(form(filled), "update")
    expect(input.id).toBeUndefined()
    expect(taskUpdateSchema.safeParse(input).success).toBe(false)
  })
})
