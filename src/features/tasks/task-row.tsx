"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowUp, Building2, TriangleAlert } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip, firstNameOf } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { taskHref } from "./links"
import type { TaskListItem } from "./queries"
import { DoneToggle, TaskStatusMenu, useTaskStatus } from "./task-status"

/** The owner's crunch period that the due date falls in, if any. */
export type RowCrunch = { label: string }

/**
 * One task in a list: a card on phones, a row on wider screens. The whole card
 * opens the task; the done toggle and status menu sit above that link.
 * People first: the owner is always shown, except under their own heading.
 */
export function TaskRow({
  task,
  today,
  crunch = null,
  showOwner = true,
  compact = false,
}: {
  task: TaskListItem
  today: IsoDate
  crunch?: RowCrunch | null
  showOwner?: boolean
  /** Smaller rows for the "Done recently" lists: no next action. */
  compact?: boolean
}) {
  const rowRef = useRef<HTMLLIElement>(null)
  const control = useTaskStatus(task.id, task.title, task.status, rowRef)
  const done = control.status === "done"

  return (
    <li
      ref={rowRef}
      data-slot="task-row"
      data-task-id={task.id}
      aria-busy={control.pending || undefined}
      className={cn(
        "relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-3 p-3 md:grid-cols-[auto_minmax(0,1fr)_10rem] md:items-start md:gap-x-4 md:p-4",
        control.pending && "opacity-70",
      )}
    >
      <DoneToggle
        title={task.title}
        status={control.status}
        onChange={(next) => control.change(next, "done")}
        className="relative z-10 -mt-1 md:-mt-0.5"
      />

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={taskHref(task.id)}
            data-task-title
            className={cn(
              "min-w-0 font-medium break-words outline-none",
              // Stretched link: the whole card opens the task.
              "after:absolute after:inset-0 after:content-['']",
              "hover:underline focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
              done && "text-muted-foreground",
            )}
          >
            {task.title}
          </Link>
          {task.priority === "high" && !done ? (
            <Badge variant="outline">
              <ArrowUp aria-hidden />
              High priority
            </Badge>
          ) : null}
        </div>

        {compact ? null : (
          <p className="line-clamp-2 text-sm text-pretty break-words text-muted-foreground">
            <span className="sr-only">Next action: </span>
            {task.nextAction}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
          {showOwner ? (
            <span className="inline-flex max-w-[12rem] min-w-0">
              <span className="sr-only">Owner: </span>
              <PersonChip person={task.owner} size="sm" />
            </span>
          ) : null}
          <DueDate date={task.dueDate} today={today} done={done} className="text-xs md:text-sm" />
          {task.organization ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground md:text-sm">
              <Building2 aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">Linked to </span>
              <span className="truncate">{task.organization.name}</span>
            </span>
          ) : null}
          {crunch && !done ? (
            // Neutral, not amber: amber means stale (spec §7). The icon is 14 px.
            <Badge variant="outline" className="[&>svg]:size-3.5">
              <TriangleAlert aria-hidden />
              <span aria-hidden>Crunch</span>
              <span className="sr-only">
                Due in {firstNameOf(task.owner.name)}&apos;s crunch period: {crunch.label}
              </span>
            </Badge>
          ) : null}
        </div>
      </div>

      <TaskStatusMenu
        title={task.title}
        status={control.status}
        onChange={(next) => control.change(next, "status")}
        pending={control.pending}
        className="relative z-10 col-start-2 w-full max-md:max-w-60 md:col-start-3 md:row-start-1"
      />
    </li>
  )
}
