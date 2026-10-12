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

/** The status menu's button, from its opening tag to its closing tag. */
function statusButton(html: string) {
  return /<button[^>]*data-task-control="status"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? ""
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

  it("has a status menu (not a <select> that saves while arrowing) and a one-tap done toggle", () => {
    const html = render()
    expect(html).not.toContain("<select")
    const button = statusButton(html)
    expect(button).toContain('aria-haspopup="menu"')
    // Named "Status for <title>: <status>".
    expect(button).toContain(
      '<span class="sr-only">Status for Send the one-pager: </span>In Progress</span>',
    )
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain("Done: Send the one-pager")
  })

  it("marks the row, its title link and its controls, so focus can follow a moved row", () => {
    const html = render()
    expect(html).toMatch(/<li[^>]* data-task-id="t1"/)
    expect(html).toMatch(/<a href="\/tasks\/t1" data-task-title/)
    expect(html).toMatch(/<button[^>]* aria-pressed="false" data-task-control="done"/)
  })

  it("marks a crunch-period due date with a neutral badge (amber means stale), named for screen readers", () => {
    const html = render({ crunch: { label: "Finals" } })
    expect(html).not.toMatch(/stale|amber/)
    const badge =
      /<span data-slot="badge" data-variant="outline"[^>]*>(?:(?!<\/span><\/div>).)*?Crunch/.exec(
        html,
      )?.[0]
    expect(badge).toBeDefined()
    expect(badge).toContain("lucide-triangle-alert")
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
