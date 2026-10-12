import { addDays, sundayOnOrAfter, toEtDate, type IsoDate } from "@/lib/dates"
import { TASK_STATUSES } from "@/lib/labels"
import type { TaskPriority, TaskStatus } from "@/lib/schemas/tasks"

/**
 * The four task views (spec §6.4) as pure functions over one list of tasks, so
 * the grouping and sorting rules are unit-tested and the page stays thin.
 */

export const TASK_VIEWS = ["mine", "owner", "status", "week"] as const
export type TaskView = (typeof TASK_VIEWS)[number]

export const taskViewLabels: Record<TaskView, string> = {
  mine: "My tasks",
  owner: "By owner",
  status: "By status",
  week: "Due this week",
}

/** `?view=` from the URL; anything unknown (or missing) is "mine". */
export function parseTaskView(value: unknown): TaskView {
  const first = Array.isArray(value) ? value[0] : value
  return TASK_VIEWS.find((view) => view === first) ?? "mine"
}

/** How far back each view shows finished tasks, in calendar days including today. */
export const DONE_WINDOW_DAYS = { mine: 7, status: 14 } as const

/** The first ET day of a window of `days` calendar days ending today. */
export function windowStart(today: IsoDate, days: number): IsoDate {
  return addDays(today, -(days - 1))
}

/** The oldest completion day any view shows, so one query covers them all. */
export function oldestDoneDay(today: IsoDate): IsoDate {
  return windowStart(today, Math.max(...Object.values(DONE_WINDOW_DAYS)))
}

/** The fields the views need; list rows carry more. */
export type ViewTask = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: IsoDate
  ownerId: string
  completedAt: string | null
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

/** Soonest due first (so overdue comes first), then high priority, then by title. */
export function compareByDue(a: ViewTask, b: ViewTask): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (byPriority !== 0) return byPriority
  return a.title.localeCompare(b.title, "en-US") || a.id.localeCompare(b.id)
}

export function isOpen(task: Pick<ViewTask, "status">): boolean {
  return task.status !== "done"
}

export function isOverdue(task: Pick<ViewTask, "status" | "dueDate">, today: IsoDate): boolean {
  return isOpen(task) && task.dueDate < today
}

/** Open tasks, soonest due first. */
export function openByDue<T extends ViewTask>(tasks: readonly T[]): T[] {
  return tasks.filter(isOpen).sort(compareByDue)
}

/** Tasks finished on or after ET day `since`, most recently finished first. */
export function doneSince<T extends ViewTask>(tasks: readonly T[], since: IsoDate): T[] {
  return tasks
    .filter((t) => t.status === "done" && t.completedAt && toEtDate(t.completedAt) >= since)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
}

/** My tasks: my open tasks by due date, then what I finished in the last 7 days. */
export function mineView<T extends ViewTask>(
  tasks: readonly T[],
  personId: string,
  today: IsoDate,
) {
  const mine = tasks.filter((t) => t.ownerId === personId)
  return {
    open: openByDue(mine),
    done: doneSince(mine, windowStart(today, DONE_WINDOW_DAYS.mine)),
  }
}

/**
 * By owner: one section per teammate in team order (even with nothing open),
 * then anyone else who still owns open tasks (e.g. a deactivated teammate), so
 * no task disappears from this view.
 */
export function ownerView<T extends ViewTask>(
  tasks: readonly T[],
  teamOrder: readonly string[],
): { ownerId: string; tasks: T[] }[] {
  const open = openByDue(tasks)
  const others = [...new Set(open.map((t) => t.ownerId))].filter((id) => !teamOrder.includes(id))
  return [...teamOrder, ...others].map((ownerId) => ({
    ownerId,
    tasks: open.filter((t) => t.ownerId === ownerId),
  }))
}

/** By status: To Do, In Progress, Blocked by due date; Done = finished in the last 14 days. */
export function statusView<T extends ViewTask>(
  tasks: readonly T[],
  today: IsoDate,
): { status: TaskStatus; tasks: T[] }[] {
  const open = openByDue(tasks)
  return TASK_STATUSES.map((status) => ({
    status,
    tasks:
      status === "done"
        ? doneSince(tasks, windowStart(today, DONE_WINDOW_DAYS.status))
        : open.filter((t) => t.status === status),
  }))
}

/** Due this week: open tasks due on or before this Sunday (today, on a Sunday), overdue first. */
export function weekView<T extends ViewTask>(tasks: readonly T[], today: IsoDate) {
  const weekEnd = sundayOnOrAfter(today)
  return { weekEnd, tasks: openByDue(tasks).filter((t) => t.dueDate <= weekEnd) }
}
