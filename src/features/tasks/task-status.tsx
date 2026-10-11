"use client"

import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react"
import { ChevronDown, Circle, CircleCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TASK_STATUSES, taskStatusLabels } from "@/lib/labels"
import type { TaskStatus } from "@/lib/schemas/tasks"
import { cn } from "@/lib/utils"
import { setTaskStatus, undoTaskChange } from "./actions"
import { callTaskAction } from "./client-calls"
import {
  forgetFocus,
  rememberFocus,
  restoreFocus,
  settleFocus,
  type StatusControl,
} from "./status-focus"

/**
 * Quick status change without leaving the page (spec §6.4). The new status
 * shows at once (useOptimistic); the Server Action saves it and refreshes the
 * page. A toast confirms ("Marked Done", announced to screen readers) with
 * Undo, or explains a failure (including a lost connection), and the control
 * snaps back. In a list, pass the row (`rowRef`): if the saved change moves
 * it to another list, focus follows it (see status-focus.ts).
 */
export function useTaskStatus(
  taskId: string,
  title: string,
  status: TaskStatus,
  rowRef?: RefObject<HTMLElement | null>,
) {
  const [optimistic, setOptimistic] = useOptimistic(status)
  const [pending, startStatusTransition] = useTransition()

  // The row stayed in its list (its status prop caught up) or its old copy unmounted.
  useEffect(() => settleFocus(taskId, status), [taskId, status])
  useEffect(() => () => restoreFocus(taskId), [taskId])

  function change(next: TaskStatus, control: StatusControl) {
    if (next === optimistic) return
    const previous = optimistic
    rememberFocus(rowRef?.current ?? null, taskId, next, control)
    startStatusTransition(async () => {
      setOptimistic(next)
      if (!(await saveTaskStatus(taskId, title, next, previous))) forgetFocus(taskId)
    })
  }

  return { status: optimistic, pending, change }
}

/** Saves a status change and says how it went. True when it saved. */
export async function saveTaskStatus(
  taskId: string,
  title: string,
  next: TaskStatus,
  previous: TaskStatus,
): Promise<boolean> {
  const result = await callTaskAction(() => setTaskStatus(taskId, next))
  if (result.status === "error") {
    toast.error(result.message)
    return false
  }
  const { undoId } = result
  toast.success(`Marked ${taskStatusLabels[next]}`, {
    description: title,
    action:
      undoId === null
        ? undefined
        : {
            label: "Undo",
            // Runs from the toast, after the row may have moved or gone.
            onClick: () => startTransition(() => undoTaskStatus(undoId, previous)),
          },
  })
  return true
}

/**
 * The toast's Undo: reverses the saved change itself (its activity_log entry),
 * so a reopened task gets its original completion time back.
 */
export async function undoTaskStatus(undoId: number, previous: TaskStatus): Promise<void> {
  const result = await callTaskAction(() => undoTaskChange(undoId))
  if (result.status === "error") toast.error(result.message)
  else toast.success(`Back to ${taskStatusLabels[previous]}`)
}

/**
 * The status menu: a button showing the status ("Status for <title>: To Do"
 * to screen readers) that opens a list of statuses. Unlike a <select>, arrowing
 * through the choices saves nothing; only picking one does.
 *
 * A mouse opens it on press (as Radix does), but touch and pen open it on a
 * finished tap: Radix would open on the touch's pointerdown, so a swipe that
 * starts on the button (it fills a phone card's width) would open the menu
 * and lock scrolling. A click from assistive tech that sends no pointer
 * events opens it too. The keyboard is left to Radix (Enter, Space, ArrowDown).
 */
export function TaskStatusMenu({
  title,
  status,
  onChange,
  pending,
  className,
}: {
  title: string
  status: TaskStatus
  onChange: (status: TaskStatus) => void
  pending?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // The last pointer that pressed the button; a click with none counts as a tap.
  const pointerType = useRef("touch")
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        onPointerDown={(event) => {
          pointerType.current = event.pointerType
          // Cancelling it stops Radix opening the menu (it skips a prevented event).
          if (event.pointerType !== "mouse") event.preventDefault()
        }}
        onClick={(event) => {
          if (pointerType.current === "mouse") return
          event.currentTarget.focus()
          setOpen(true)
        }}
      >
        <Button
          type="button"
          variant="outline"
          data-task-control="status"
          aria-busy={pending || undefined}
          className={cn("justify-between px-3 font-normal", className)}
        >
          <span className="min-w-0 truncate">
            <span className="sr-only">Status for {title}: </span>
            {taskStatusLabels[status]}
          </span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(value) => {
            const next = TASK_STATUSES.find((s) => s === value)
            if (next) onChange(next)
          }}
        >
          {TASK_STATUSES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-11 md:min-h-8">
              {taskStatusLabels[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
      data-task-control="done"
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

/** Done toggle + status menu, for the task page header. */
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
    <div className="flex items-center gap-2">
      <DoneToggle
        title={title}
        status={control.status}
        onChange={(next) => control.change(next, "done")}
      />
      <TaskStatusMenu
        title={title}
        status={control.status}
        onChange={(next) => control.change(next, "status")}
        pending={control.pending}
        className="w-40"
      />
    </div>
  )
}
