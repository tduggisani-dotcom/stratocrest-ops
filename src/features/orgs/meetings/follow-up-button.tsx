"use client"

import { startTransition, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleCheck, ListPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { archiveTask } from "@/features/tasks/actions"
import { taskHref } from "@/features/tasks/links"
import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"
import { addFollowUpTask } from "./actions"
import type { FollowUpResult } from "./types"

const connectionFailed = { status: "error", message: CONNECTION_ERROR } as const

/**
 * "Add follow-up task" in ONE click (spec §6.2): the task is prefilled from the
 * meeting and the org (see addFollowUpTask). The toast offers Open and Undo
 * (archives it). The button is off while it works, and the server finds an
 * existing open follow-up instead of adding a second one. Once there is one,
 * this shows it with a link.
 */
export function FollowUpTaskButton({
  meetingId,
  existing,
  preview,
}: {
  meetingId: string
  /** The meeting's follow-up task, if it has one (not archived). */
  existing: { id: string; done: boolean } | null
  /** "For Sam, due Oct 16": what the click will create. */
  preview: string
}) {
  const router = useRouter()
  const [pending, startAdding] = useTransition()
  // Shown until the page's data catches up (refresh) with the task just added.
  const [added, setAdded] = useState<string | null>(null)
  if (existing !== null && added !== null) setAdded(null)
  const task = existing ?? (added ? { id: added, done: false } : null)

  // After a click, focus moves to "Open task" (the button it replaces is gone).
  // Once only: effects re-run when Activity shows the page again.
  const focusLink = useRef(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const shownTaskId = task?.id
  useEffect(() => {
    if (!focusLink.current || !shownTaskId) return
    focusLink.current = false
    linkRef.current?.focus()
  }, [shownTaskId])

  function add() {
    startAdding(async () => {
      const result = await callAction<FollowUpResult>(
        () => addFollowUpTask(meetingId),
        connectionFailed,
      )
      if (result.status === "error") {
        toast.error(result.message)
        return
      }
      const { taskId, created } = result
      focusLink.current = true
      setAdded(taskId)
      toast.success(
        created ? "Follow-up task added" : "This meeting already has a follow-up task",
        {
          action: created
            ? { label: "Undo", onClick: () => startTransition(() => undoFollowUp(taskId)) }
            : undefined,
          cancel: { label: "Open", onClick: () => router.push(taskHref(taskId)) },
        },
      )
    })
  }

  async function undoFollowUp(taskId: string) {
    const result = await callAction(() => archiveTask(taskId), connectionFailed)
    if (result.status === "error") {
      toast.error(result.message)
      return
    }
    setAdded((current) => (current === taskId ? null : current))
    toast.success("Follow-up task removed")
  }

  return (
    <div aria-live="polite" className="space-y-2">
      {task ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CircleCheck aria-hidden className="size-4 text-primary" />
            {task.done ? "Follow-up task done" : "Follow-up task added"}
          </span>
          <Link
            ref={linkRef}
            href={taskHref(task.id)}
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
          >
            Open task
          </Link>
        </p>
      ) : (
        <>
          <Button
            type="button"
            onClick={add}
            disabled={pending}
            aria-disabled={pending}
            className="max-md:w-full"
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ListPlus aria-hidden />}
            {pending ? "Adding…" : "Add follow-up task"}
          </Button>
          <p className="text-sm text-muted-foreground">{preview}</p>
        </>
      )}
    </div>
  )
}
