import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { TaskListItem } from "./queries"
import { TaskRow } from "./task-row"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("./actions", () => ({ setTaskStatus: vi.fn() }))

const task: TaskListItem = {
  id: "t1",
  title: "Send the one-pager",
  nextAction: "Email Jane the deck",
  status: "in_progress",
  priority: "high",
  dueDate: "2026-10-09",
  ownerId: "sam",
  completedAt: null,
  owner: { id: "sam", name: "Sam Browning", avatarUrl: null },
  organization: { id: "o1", name: "Example Seed Fund", kind: "investor" },
}

/** The <option> that a select starts on. */
function selectedOption(value: string, label: string) {
  return new RegExp(`<option[^>]* value="${value}" selected="">${label}<`)
}

function render(props: Partial<Parameters<typeof TaskRow>[0]> = {}) {
  return renderToStaticMarkup(
    <ul>
      <TaskRow task={task} today="2026-10-11" {...props} />
    </ul>,
  )
}

describe("TaskRow", () => {
  it("shows the title as a link, the next action, owner, due date, priority and org", () => {
    const html = render()
    expect(html).toContain('href="/tasks/t1"')
    expect(html).toContain("Send the one-pager")
    expect(html).toContain("Email Jane the deck")
    expect(html).toContain("Sam Browning")
    expect(html).toContain("overdue 2 days ago")
    expect(html).toContain("High priority")
    expect(html).toContain("Example Seed Fund")
  })

  it("has a labelled status select and a one-tap done toggle", () => {
    const html = render()
    expect(html).toContain("Status for Send the one-pager")
    expect(html).toMatch(selectedOption("in_progress", "In Progress"))
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain("Done: Send the one-pager")
  })

  it("marks a crunch-period due date in amber, with the period for screen readers", () => {
    const html = render({ crunch: { label: "Finals" } })
    expect(html).toContain("text-stale")
    expect(html).toContain("Due in Sam&#x27;s crunch period: Finals")
  })

  it("can leave out the owner (under the owner's own heading) and the next action", () => {
    const html = render({ showOwner: false, compact: true })
    expect(html).not.toContain("Sam Browning")
    expect(html).not.toContain("Email Jane the deck")
  })

  it("shows a done task as done: pressed toggle, no overdue, no priority or crunch", () => {
    const html = render({
      task: { ...task, status: "done", completedAt: "2026-10-10T12:00:00Z" },
      crunch: { label: "Finals" },
    })
    expect(html).toContain('aria-pressed="true"')
    expect(html).not.toContain("overdue")
    expect(html).not.toContain("High priority")
    expect(html).not.toContain("crunch period")
  })

  it("only shows the priority badge when it's high", () => {
    expect(render({ task: { ...task, priority: "medium" } })).not.toContain("priority")
  })
})
