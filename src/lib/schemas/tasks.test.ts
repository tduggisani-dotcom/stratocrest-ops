import { describe, expect, it } from "vitest"
import {
  TASK_LIMITS,
  TASK_LINK_FIELDS,
  TASK_MESSAGES,
  taskIdSchema,
  taskInputSchema,
  taskStatusUpdateSchema,
  taskUpdateSchema,
} from "@/lib/schemas/tasks"

const OWNER = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const TASK = "0cfbcc2e-55df-43f2-80ed-bf189b073cc3"

const valid = {
  title: "Send the one-pager",
  next_action: "Email Jane the deck",
  owner_id: OWNER,
  due_date: "2026-10-14",
}

/** The first message per field, like the form shows. */
function errorsOf(input: unknown, schema = taskInputSchema) {
  const result = schema.safeParse(input)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message
  return errors
}

describe("taskInputSchema", () => {
  it("accepts the four required fields and fills in the defaults", () => {
    const result = taskInputSchema.parse(valid)
    expect(result).toEqual({ ...valid, status: "to_do", priority: "medium" })
  })

  it("keeps the given status, priority, notes and links", () => {
    const result = taskInputSchema.parse({
      ...valid,
      status: "blocked",
      priority: "high",
      notes: "Waiting on the lab results.",
      organization_id: ORG,
    })
    expect(result).toMatchObject({
      status: "blocked",
      priority: "high",
      notes: "Waiting on the lab results.",
      organization_id: ORG,
    })
  })

  it("trims the title, next action and notes", () => {
    const result = taskInputSchema.parse({
      ...valid,
      title: "  Book the room  ",
      next_action: "\tCall Bounce\n",
      notes: "  context  ",
    })
    expect(result.title).toBe("Book the room")
    expect(result.next_action).toBe("Call Bounce")
    expect(result.notes).toBe("context")
  })

  it("explains every missing required field", () => {
    expect(errorsOf({})).toEqual({
      title: TASK_MESSAGES.title,
      next_action: TASK_MESSAGES.nextAction,
      owner_id: TASK_MESSAGES.owner,
      due_date: TASK_MESSAGES.dueDate,
    })
  })

  it.each(["", " ", "   \t\n "])("rejects a blank title (%j)", (title) => {
    expect(errorsOf({ ...valid, title })).toEqual({ title: TASK_MESSAGES.title })
  })

  it.each(["", " ", "\n\n", " "])("rejects a blank or space-only next action (%j)", (next) => {
    expect(errorsOf({ ...valid, next_action: next })).toEqual({
      next_action: TASK_MESSAGES.nextAction,
    })
  })

  it("gives an example of a concrete next action", () => {
    expect(TASK_MESSAGES.nextAction).toBe(
      'What\'s the very next step? For example: "Email Jane the deck".',
    )
  })

  it("enforces the database length limits", () => {
    expect(errorsOf({ ...valid, title: "a".repeat(TASK_LIMITS.title) })).toEqual({})
    expect(errorsOf({ ...valid, title: "a".repeat(TASK_LIMITS.title + 1) })).toEqual({
      title: TASK_MESSAGES.titleTooLong,
    })
    expect(errorsOf({ ...valid, next_action: "a".repeat(TASK_LIMITS.next_action + 1) })).toEqual({
      next_action: TASK_MESSAGES.nextActionTooLong,
    })
    expect(errorsOf({ ...valid, notes: "a".repeat(TASK_LIMITS.notes + 1) })).toEqual({
      notes: TASK_MESSAGES.notesTooLong,
    })
  })

  it.each([
    ["not a uuid", "john"],
    ["a uuid with a typo", `${OWNER.slice(0, -1)}x`],
    ["a number", 42],
    ["null", null],
  ])("rejects an owner that is %s", (_label, owner_id) => {
    expect(errorsOf({ ...valid, owner_id })).toEqual({ owner_id: TASK_MESSAGES.owner })
  })

  it.each([
    ["US format", "10/14/2026"],
    ["no leading zeros", "2026-1-4"],
    ["an impossible day", "2026-02-30"],
    ["a timestamp", "2026-10-14T09:00:00Z"],
    ["a word", "tomorrow"],
    ["empty", ""],
  ])("rejects a due date in %s", (_label, due_date) => {
    expect(errorsOf({ ...valid, due_date })).toEqual({ due_date: TASK_MESSAGES.dueDate })
  })

  it("accepts a leap day and flags a year that is surely a typo", () => {
    expect(errorsOf({ ...valid, due_date: "2028-02-29" })).toEqual({})
    expect(errorsOf({ ...valid, due_date: "0202-10-14" })).toEqual({
      due_date: TASK_MESSAGES.dueDateRange,
    })
    expect(errorsOf({ ...valid, due_date: "2206-10-14" })).toEqual({
      due_date: TASK_MESSAGES.dueDateRange,
    })
  })

  it("rejects an unknown status or priority with a readable message", () => {
    expect(errorsOf({ ...valid, status: "Done" })).toEqual({ status: TASK_MESSAGES.status })
    expect(errorsOf({ ...valid, priority: "urgent" })).toEqual({
      priority: TASK_MESSAGES.priority,
    })
  })

  it.each(TASK_LINK_FIELDS)("accepts a uuid, null (clear) or nothing for %s", (field) => {
    expect(taskInputSchema.parse({ ...valid, [field]: ORG })[field]).toBe(ORG)
    expect(taskInputSchema.parse({ ...valid, [field]: null })[field]).toBeNull()
    expect(field in taskInputSchema.parse(valid)).toBe(false)
  })

  it.each(TASK_LINK_FIELDS)("rejects a malformed %s", (field) => {
    expect(errorsOf({ ...valid, [field]: "not-a-uuid" })).toEqual({ [field]: TASK_MESSAGES.link })
    expect(errorsOf({ ...valid, [field]: "" })).toEqual({ [field]: TASK_MESSAGES.link })
  })

  it("accepts null notes (cleared) and drops fields the database sets itself", () => {
    const result = taskInputSchema.parse({
      ...valid,
      notes: null,
      created_by: OWNER,
      completed_at: "2026-10-11T12:00:00Z",
      archived_at: "2026-10-11T12:00:00Z",
    })
    expect(result.notes).toBeNull()
    expect(result).not.toHaveProperty("created_by")
    expect(result).not.toHaveProperty("completed_at")
    expect(result).not.toHaveProperty("archived_at")
  })
})

describe("taskUpdateSchema", () => {
  it("needs the task's id as well as every required field", () => {
    expect(taskUpdateSchema.parse({ ...valid, id: TASK }).id).toBe(TASK)
    expect(errorsOf({ ...valid, id: "nope" }, taskUpdateSchema)).toEqual({
      id: TASK_MESSAGES.task,
    })
    expect(errorsOf({ id: TASK }, taskUpdateSchema)).toHaveProperty("next_action")
  })
})

describe("taskStatusUpdateSchema", () => {
  it("accepts an id and a stored status value", () => {
    expect(taskStatusUpdateSchema.parse({ id: TASK, status: "in_progress" })).toEqual({
      id: TASK,
      status: "in_progress",
    })
  })

  it("rejects labels, unknown values and bad ids", () => {
    expect(taskStatusUpdateSchema.safeParse({ id: TASK, status: "In Progress" }).success).toBe(
      false,
    )
    expect(taskStatusUpdateSchema.safeParse({ id: TASK }).success).toBe(false)
    expect(taskStatusUpdateSchema.safeParse({ id: "1", status: "done" }).success).toBe(false)
  })
})

describe("taskIdSchema", () => {
  it("accepts a database uuid and rejects anything else", () => {
    expect(taskIdSchema.safeParse(TASK).success).toBe(true)
    expect(taskIdSchema.safeParse("new").success).toBe(false)
    expect(taskIdSchema.safeParse(`${TASK}'; drop table tasks;--`).success).toBe(false)
  })
})
