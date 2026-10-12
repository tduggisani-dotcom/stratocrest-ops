import { describe, expect, it } from "vitest"
import {
  compareByDue,
  doneSince,
  isOverdue,
  mineView,
  oldestDoneDay,
  openByDue,
  ownerView,
  parseTaskView,
  statusView,
  weekView,
  windowStart,
  type ViewTask,
} from "./views"

const JOHN = "john"
const SAM = "sam"
const BRAD = "brad"
const FORMER = "former"
// Sunday, the day of the team meeting.
const SUNDAY = "2026-10-11"
const WEDNESDAY = "2026-10-14"

let seq = 0
function task(overrides: Partial<ViewTask> = {}): ViewTask {
  seq += 1
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    status: "to_do",
    priority: "medium",
    dueDate: "2026-10-20",
    ownerId: JOHN,
    completedAt: null,
    ...overrides,
  }
}

const ids = (tasks: readonly ViewTask[]) => tasks.map((t) => t.id)

describe("parseTaskView", () => {
  it.each(["mine", "owner", "status", "week"])("reads ?view=%s", (view) => {
    expect(parseTaskView(view)).toBe(view)
  })

  it.each([undefined, "", "Mine", "all", 3, null])("falls back to mine for %j", (value) => {
    expect(parseTaskView(value)).toBe("mine")
  })

  it("uses the first value when the param repeats", () => {
    expect(parseTaskView(["week", "owner"])).toBe("week")
  })
})

describe("compareByDue / openByDue", () => {
  it("puts the soonest due first, so overdue tasks lead", () => {
    const later = task({ dueDate: "2026-10-20" })
    const overdue = task({ dueDate: "2026-10-01" })
    const today = task({ dueDate: SUNDAY })
    expect(ids(openByDue([later, overdue, today]))).toEqual(ids([overdue, today, later]))
  })

  it("breaks ties by priority (high first), then by title", () => {
    const low = task({ priority: "low", title: "A" })
    const highB = task({ priority: "high", title: "B" })
    const highA = task({ priority: "high", title: "A" })
    const medium = task({ priority: "medium", title: "A" })
    expect(ids([low, highB, medium, highA].sort(compareByDue))).toEqual(
      ids([highA, highB, medium, low]),
    )
  })

  it("leaves out done tasks and doesn't change the input", () => {
    const input = [task({ status: "done", completedAt: "2026-10-10T12:00:00Z" }), task()]
    const copy = [...input]
    expect(openByDue(input)).toHaveLength(1)
    expect(input).toEqual(copy)
  })
})

describe("isOverdue", () => {
  it("is overdue only when open and due before today (ET calendar days)", () => {
    expect(isOverdue({ status: "to_do", dueDate: "2026-10-10" }, SUNDAY)).toBe(true)
    expect(isOverdue({ status: "blocked", dueDate: "2026-10-10" }, SUNDAY)).toBe(true)
    expect(isOverdue({ status: "to_do", dueDate: SUNDAY }, SUNDAY)).toBe(false)
    expect(isOverdue({ status: "done", dueDate: "2026-10-01" }, SUNDAY)).toBe(false)
  })
})

describe("windowStart / oldestDoneDay", () => {
  it("counts today as the first of the window's days", () => {
    expect(windowStart(SUNDAY, 1)).toBe(SUNDAY)
    expect(windowStart(SUNDAY, 7)).toBe("2026-10-05")
    expect(windowStart("2026-03-03", 14)).toBe("2026-02-18")
  })

  it("reaches back far enough for the by-status view's 14 days", () => {
    expect(oldestDoneDay(SUNDAY)).toBe("2026-09-28")
  })
})

describe("doneSince", () => {
  it("uses the ET day the task was finished on", () => {
    // 2026-10-05 01:30 UTC is still Oct 4 in New York.
    const lateOct4 = task({ status: "done", completedAt: "2026-10-05T01:30:00Z" })
    const oct5 = task({ status: "done", completedAt: "2026-10-05T04:30:00Z" })
    expect(ids(doneSince([lateOct4, oct5], "2026-10-05"))).toEqual(ids([oct5]))
  })

  it("lists the most recently finished first and ignores open tasks", () => {
    const older = task({ status: "done", completedAt: "2026-10-06T15:00:00+00:00" })
    const newer = task({ status: "done", completedAt: "2026-10-10T15:00:00+00:00" })
    expect(ids(doneSince([older, task(), newer], "2026-10-01"))).toEqual(ids([newer, older]))
  })
})

describe("mineView", () => {
  it("shows only my tasks: open by due date, then done in the last 7 days", () => {
    const mineLater = task({ dueDate: "2026-10-30" })
    const mineOverdue = task({ dueDate: "2026-10-02" })
    const samsTask = task({ ownerId: SAM, dueDate: "2026-10-01" })
    const doneRecently = task({ status: "done", completedAt: "2026-10-05T14:00:00Z" })
    const doneLongAgo = task({ status: "done", completedAt: "2026-10-04T14:00:00Z" })
    const samsDone = task({ ownerId: SAM, status: "done", completedAt: "2026-10-10T14:00:00Z" })

    const view = mineView(
      [mineLater, mineOverdue, samsTask, doneRecently, doneLongAgo, samsDone],
      JOHN,
      SUNDAY,
    )
    expect(ids(view.open)).toEqual(ids([mineOverdue, mineLater]))
    expect(ids(view.done)).toEqual(ids([doneRecently]))
  })

  it("is empty for someone with no tasks", () => {
    expect(mineView([task()], BRAD, SUNDAY)).toEqual({ open: [], done: [] })
  })
})

describe("ownerView", () => {
  it("has a section per teammate in team order, including ones with nothing open", () => {
    const sams = task({ ownerId: SAM })
    const johnsSoon = task({ dueDate: "2026-10-12" })
    const johnsLater = task({ dueDate: "2026-10-25" })
    const johnsDone = task({ status: "done", completedAt: "2026-10-10T12:00:00Z" })
    const view = ownerView([sams, johnsLater, johnsDone, johnsSoon], [JOHN, BRAD, SAM])
    expect(view.map((s) => [s.ownerId, ids(s.tasks)])).toEqual([
      [JOHN, ids([johnsSoon, johnsLater])],
      [BRAD, []],
      [SAM, ids([sams])],
    ])
  })

  it("adds anyone outside the team list who still owns open tasks, at the end", () => {
    const formers = task({ ownerId: FORMER })
    const formersDone = task({ ownerId: "gone", status: "done", completedAt: "2026-10-10T12:00Z" })
    const view = ownerView([formers, formersDone], [JOHN])
    expect(view.map((s) => s.ownerId)).toEqual([JOHN, FORMER])
  })
})

describe("statusView", () => {
  it("groups open tasks by status in board order, done = finished in the last 14 days", () => {
    const blocked = task({ status: "blocked" })
    const doing = task({ status: "in_progress" })
    const todoLater = task({ dueDate: "2026-11-01" })
    const todoSoon = task({ dueDate: "2026-10-12" })
    const doneIn = task({ status: "done", completedAt: "2026-09-28T12:00:00Z" })
    const doneOut = task({ status: "done", completedAt: "2026-09-27T12:00:00Z" })

    const view = statusView([blocked, doing, todoLater, todoSoon, doneIn, doneOut], SUNDAY)
    expect(view.map((s) => [s.status, ids(s.tasks)])).toEqual([
      ["to_do", ids([todoSoon, todoLater])],
      ["in_progress", ids([doing])],
      ["blocked", ids([blocked])],
      ["done", ids([doneIn])],
    ])
  })
})

describe("weekView", () => {
  it("on a Wednesday: open tasks due through Sunday, overdue first", () => {
    const overdue = task({ dueDate: "2026-10-09" })
    const thursday = task({ dueDate: "2026-10-15" })
    const sunday = task({ dueDate: "2026-10-18", ownerId: SAM })
    const nextMonday = task({ dueDate: "2026-10-19" })
    const done = task({ dueDate: "2026-10-15", status: "done", completedAt: "2026-10-13T12:00Z" })

    const view = weekView([nextMonday, sunday, thursday, overdue, done], WEDNESDAY)
    expect(view.weekEnd).toBe("2026-10-18")
    expect(ids(view.tasks)).toEqual(ids([overdue, thursday, sunday]))
  })

  it("on a Sunday the week ends today", () => {
    const today = task({ dueDate: SUNDAY })
    const monday = task({ dueDate: "2026-10-12" })
    const view = weekView([today, monday], SUNDAY)
    expect(view.weekEnd).toBe(SUNDAY)
    expect(ids(view.tasks)).toEqual(ids([today]))
  })

  it("crosses a month and a year end by calendar day", () => {
    expect(weekView([], "2026-12-29").weekEnd).toBe("2027-01-03")
  })
})
