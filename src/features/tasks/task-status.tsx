"use client"

import { startTransition, useId, useOptimistic, useTransition } from "react"
import { Circle, CircleCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { TASK_STATUSES, taskStatusLabels } from "@/lib/labels"
import type { TaskStatus } from "@/lib/schemas/tasks"
import { cn } from "@/lib/utils"
import { setTaskStatus } from "./actions"

/**
 * Quick status change without leaving the page (spec §6.4). The new status
 * shows at once (useOptimistic); the Server Action saves it and refreshes the
 * page. A toast confirms ("Marked Done", announced to screen readers) with
 * Undo, or explains a failure, and the control snaps back.
 */
export function useTaskStatus(taskId: string, title: string, status: TaskStatus) {
  const [optimistic, setOptimistic] = useOptimistic(status)
  const [pending, startStatusTransition] = useTransition()

  function change(next: TaskStatus) {
    if (next === optimistic) return
    const previous = optimistic
    startStatusTransition(async () => {
      setOptimistic(next)
      const result = await setTaskStatus(taskId, next)
      if (result.status === "error") {
        toast.error(result.message)
        return
      }
      toast.success(`Marked ${taskStatusLabels[next]}`, {
        description: title,
        action: { label: "Undo", onClick: () => undoStatus(taskId, previous) },
      })
    })
  }

  return { status: optimistic, pending, change }
}

/** Undo runs from the toast, after the row may have moved or gone. */
function undoStatus(taskId: string, status: TaskStatus) {
  startTransition(async () => {
    const result = await setTaskStatus(taskId, status)
    if (result.status === "error") toast.error(result.message)
    else toast.success(`Back to ${taskStatusLabels[status]}`)
  })
}

/** The status <select>. Its label is visually hidden in lists ("Status for <title>"). */
export function TaskStatusSelect({
  title,
  status,
  onChange,
  pending,
  showLabel = false,
  className,
}: {
  title: string
  status: TaskStatus
  onChange: (status: TaskStatus) => void
  pending?: boolean
  showLabel?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className={showLabel ? "text-sm font-medium" : "sr-only"}>
        {showLabel ? "Status" : `Status for ${title}`}
      </label>
      <NativeSelect
        id={id}
        value={status}
        aria-busy={pending || undefined}
        onChange={(event) => onChange(event.target.value as TaskStatus)}
      >
        {TASK_STATUSES.map((value) => (
          <NativeSelectOption key={value} value={value}>
            {taskStatusLabels[value]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

/** One tap to mark done (or reopen). 44 px on phones. */
export function DoneToggle({
  title,
  status,
  onChange,
  className,
}: {
  title: string
  status: TaskStatus
  onChange: (status: TaskStatus) => void
  className?: string
}) {
  const done = status === "done"
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={done}
      onClick={() => onChange(done ? "to_do" : "done")}
      className={cn("rounded-full", className)}
    >
      {done ? (
        <CircleCheck aria-hidden className="size-6 text-good" />
      ) : (
        <Circle aria-hidden className="size-6 text-muted-foreground" />
      )}
      <span className="sr-only">Done: {title}</span>
    </Button>
  )
}

/** Done toggle + status select, for the task page header. */
export function TaskStatusControl({
  taskId,
  title,
  status,
}: {
  taskId: string
  title: string
  status: TaskStatus
}) {
  const control = useTaskStatus(taskId, title, status)
  return (
    <div className="flex items-end gap-2">
      <DoneToggle title={title} status={control.status} onChange={control.change} />
      <TaskStatusSelect
        title={title}
        status={control.status}
        onChange={control.change}
        pending={control.pending}
        showLabel
        className="w-40"
      />
    </div>
  )
}
