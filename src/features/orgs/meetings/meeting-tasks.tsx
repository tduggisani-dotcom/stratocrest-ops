import type { ReactNode } from "react"
import Link from "next/link"
import { CircleCheck, ListTodo, Plus } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { newTaskHref, taskHref } from "@/features/tasks/links"
import { ItemRow } from "@/features/this-week/components/section-card"
import type { IsoDate } from "@/lib/dates"
import { taskStatusLabels } from "@/lib/labels"
import type { MeetingTask } from "./queries"

/**
 * Tasks linked to this meeting, each with its owner, due date and status
 * (open first). `addHref` prefills a new task with the org, the meeting and
 * the follow-up owner, and comes back here. Server-safe.
 */
export function MeetingTaskList({
  tasks,
  addHref,
  followUp,
  today,
}: {
  tasks: readonly MeetingTask[]
  addHref: ReturnType<typeof newTaskHref> | null
  /** The one-click follow-up button, shown when the meeting has no follow-up task. */
  followUp: ReactNode
  today: IsoDate
}) {
  const addButton = addHref ? (
    <Button asChild variant="outline" className="max-md:w-full">
      <Link href={addHref}>
        <Plus aria-hidden />
        {followUp || tasks.length > 0 ? "Add another task" : "Add a task"}
      </Link>
    </Button>
  ) : null

  if (tasks.length === 0) {
    return (
      <EmptyState
        size="compact"
        titleAs="h3"
        icon={ListTodo}
        title="No tasks from this meeting yet"
        description="Turn what was agreed into tasks, each with one owner, a next action and a date. The follow-up task is one click."
        action={
          <>
            {followUp}
            {addButton}
          </>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <ul aria-label="Tasks from this meeting" className="divide-y">
        {tasks.map((task) => (
          <ItemRow
            key={task.id}
            href={taskHref(task.id)}
            title={task.title}
            detail={task.nextAction}
          >
            <PersonChip person={task.owner} size="sm" />
            <DueDate date={task.dueDate} today={today} done={task.status === "done"} />
            {task.status === "done" ? (
              <span className="inline-flex items-center gap-1 font-medium text-good">
                <CircleCheck aria-hidden className="size-3.5" />
                {taskStatusLabels.done}
              </span>
            ) : (
              <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
            )}
          </ItemRow>
        ))}
      </ul>
      {followUp || addButton ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          {followUp}
          {addButton}
        </div>
      ) : null}
    </div>
  )
}
