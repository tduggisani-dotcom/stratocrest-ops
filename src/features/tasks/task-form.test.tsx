import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CONNECTION_ERROR } from "@/lib/action-calls"
import { createTask, updateTask } from "./actions"
import type { TaskFormOptions } from "./options"
import { TaskForm, taskFormActions } from "./task-form"
import { initialTaskFormState } from "./types"

// Render the client component on its own: no router, no Server Actions.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("./actions", () => ({ createTask: vi.fn(), updateTask: vi.fn() }))

const SAM = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"
const JOHN = "f294266f-162f-43dc-a6d6-81aa7192d182"
const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"

const options: TaskFormOptions = {
  people: [
    { id: JOHN, name: "John LaRocco" },
    { id: SAM, name: "Sam Browning" },
  ],
  crunchPeriods: [
    { personId: SAM, label: "Finals", startDate: "2026-12-07", endDate: "2026-12-18" },
  ],
  organizations: [
    { value: ORG, label: "Example Seed Fund", kind: "investor" },
    { value: "c1", label: "Example Construction Co.", kind: "customer" },
  ],
  sessions: [{ value: "s1", label: "W2 · Oct 14 · Goal Setting" }],
  keyResults: [],
  teamMeetings: [{ value: "tm1", label: "Sun, Oct 18 (upcoming)" }],
  orgMeetings: [],
}

/** The <option> that a select starts on. */
function selectedOption(value: string, label: string) {
  return new RegExp(`<option[^>]* value="${value}" selected="">${label}<`)
}

function render(props: Parameters<typeof TaskForm>[0]) {
  return renderToStaticMarkup(<TaskForm {...props} />)
}

/** The crunch warning's aria-live region, from its opening tag to its closing tag. */
function liveRegion(html: string) {
  return /<div id="[^"]*-crunch"[^>]*>.*?<\/div>/.exec(html)?.[0]
}

afterEach(() => vi.restoreAllMocks())

describe("TaskForm", () => {
  it("labels every field and marks the required ones", () => {
    const html = render({
      mode: "create",
      returnTo: "/tasks",
      options,
      defaults: { owner_id: JOHN, due_date: "2026-10-18", priority: "medium" },
    })
    for (const label of [
      "Title",
      "Next action",
      "Owner",
      "Due date",
      "Priority",
      "Notes",
      "Investor or customer",
      "Synthe6 session",
      "Key result",
      "Sunday meeting",
      "Investor or customer meeting",
    ]) {
      expect(html).toContain(`>${label}`)
    }
    expect(html.match(/aria-required="true"/g)).toHaveLength(4)
    expect(html).toContain('name="return_to" value="/tasks"')
    expect(html).toContain("Add task")
    // A new task has no status field: it starts as To Do.
    expect(html).not.toContain('name="status"')
  })

  it("prefills owner, due date and links, and opens Link to… when one is set", () => {
    const html = render({
      mode: "create",
      returnTo: "/tasks",
      options,
      defaults: { owner_id: SAM, due_date: "2026-10-20", organization_id: ORG },
    })
    expect(html).toMatch(selectedOption(SAM, "Sam Browning"))
    expect(html).toContain('value="2026-10-20"')
    expect(html).toMatch(selectedOption(ORG, "Example Seed Fund"))
    expect(html).toMatch(/<optgroup[^>]* label="Investors"/)
    expect(html).toMatch(/<optgroup[^>]* label="Customers"/)
    expect(html).toMatch(/<details open=""/)
    expect(html).toContain("No key results yet.")
  })

  it("keeps Link to… closed when nothing is linked", () => {
    const html = render({
      mode: "create",
      returnTo: "/tasks",
      options,
      defaults: { owner_id: JOHN, due_date: "2026-10-20" },
    })
    expect(html).not.toMatch(/<details open=""/)
  })

  it("warns (without blocking) when the due date is in the owner's crunch period", () => {
    const html = render({
      mode: "create",
      returnTo: "/tasks",
      options,
      defaults: { owner_id: SAM, due_date: "2026-12-10" },
    })
    expect(html).toContain(
      "The due date falls in Sam&#x27;s crunch period: Finals (Dec 7 – Dec 18). You can still save it.",
    )
    // The due date field points at the warning for screen readers.
    expect(html).toMatch(/type="date"[^>]*aria-describedby="[^"]*-crunch"/)
    // Neutral, not amber: amber means stale (spec §7).
    expect(liveRegion(html)).toContain("bg-muted/50")
    expect(html).not.toMatch(/stale|amber/)
  })

  it("keeps the warning's live region in the accessibility tree while it's empty", () => {
    const html = render({
      mode: "create",
      returnTo: "/tasks",
      options,
      defaults: { owner_id: JOHN, due_date: "2026-10-20" },
    })
    const region = liveRegion(html)
    expect(region).toMatch(/aria-live="polite"/)
    expect(region).toMatch(/><\/div>$/) // empty
    // Not display:none (e.g. Tailwind's hidden / empty:hidden), or screen readers may miss
    // the warning when it appears.
    expect(region).not.toMatch(/hidden|display:\s*none/)
  })

  it("doesn't warn for someone else's crunch period, or outside it", () => {
    for (const defaults of [
      { owner_id: JOHN, due_date: "2026-12-10" },
      { owner_id: SAM, due_date: "2026-12-19" },
    ]) {
      expect(render({ mode: "create", returnTo: "/tasks", options, defaults })).not.toContain(
        "crunch period",
      )
    }
  })

  it("edits: shows the saved values, the status, and the task id", () => {
    const html = render({
      mode: "edit",
      taskId: "t1",
      options,
      defaults: {
        title: "Send the deck",
        next_action: "Email Jane",
        owner_id: JOHN,
        due_date: "2026-10-20",
        status: "blocked",
        priority: "high",
        notes: "Waiting on numbers",
      },
    })
    expect(html).toContain('name="id" value="t1"')
    expect(html).toContain('value="Send the deck"')
    expect(html).toContain(">Email Jane</textarea>")
    expect(html).toContain(">Waiting on numbers</textarea>")
    expect(html).toMatch(selectedOption("blocked", "Blocked"))
    expect(html).toMatch(/name="priority" checked="" value="high"/)
    expect(html).toContain("Save changes")
    expect(html).not.toContain("return_to")
  })

  it("doesn't warn about a crunch period for a done task", () => {
    const html = render({
      mode: "edit",
      taskId: "t1",
      options,
      defaults: { owner_id: SAM, due_date: "2026-12-10", status: "done" },
    })
    expect(html).not.toContain("crunch period")
  })
})

describe("taskFormActions", () => {
  function submitted() {
    const formData = new FormData()
    formData.set("title", "Email Jane the deck")
    formData.set("owner_id", SAM)
    formData.set("due_date", "2026-10-20")
    return formData
  }

  it.each(["create", "edit"] as const)(
    "%s: a failed request returns an error state that refills the form (no error screen)",
    async (mode) => {
      vi.spyOn(console, "error").mockImplementation(() => {})
      const action = mode === "create" ? createTask : updateTask
      vi.mocked(action).mockRejectedValueOnce(new TypeError("Failed to fetch"))

      const state = await taskFormActions[mode](initialTaskFormState, submitted())

      expect(state).toMatchObject({
        status: "error",
        message: CONNECTION_ERROR,
        fieldErrors: {},
        values: { title: "Email Jane the deck", owner_id: SAM, due_date: "2026-10-20" },
      })
      // Only a success moves a new task's form on.
      expect(state.redirectTo).toBeUndefined()
    },
  )

  it("passes the action's own result through", async () => {
    vi.mocked(createTask).mockResolvedValueOnce({
      status: "success",
      id: "t1",
      warnings: [],
      redirectTo: "/tasks",
    })
    await expect(taskFormActions.create(initialTaskFormState, submitted())).resolves.toEqual({
      status: "success",
      id: "t1",
      warnings: [],
      redirectTo: "/tasks",
    })
  })
})
