"use client"

import { startTransition, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { archiveTask, restoreTask } from "./actions"
import { callTaskAction } from "./client-calls"

/**
 * Archive in two steps, without a dialog: "Archive task", then "Yes, archive"
 * or "Cancel". Tasks are never deleted; the toast offers Undo, and an archived
 * task's page has Restore. A failed request shows a toast and keeps the page.
 */
export function ArchiveTaskButton({ taskId, title }: { taskId: string; title: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, startArchive] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  // Next keeps visited pages alive (React <Activity>): come back to the plain
  // button, not a half-finished confirmation.
  useLayoutEffect(() => () => setConfirming(false), [])

  // Keyboard focus follows the step: onto "Yes, archive", and back after "Cancel".
  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      triggerRef.current?.focus()
    }
  }, [confirming])

  function archive() {
    startArchive(async () => {
      const result = await callTaskAction(() => archiveTask(taskId))
      if (result.status === "error") {
        toast.error(result.message)
        return
      }
      toast.success("Task archived", {
        description: title,
        action: { label: "Undo", onClick: () => startTransition(() => restoreArchived(taskId)) },
      })
      router.push("/tasks")
    })
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="max-md:w-full"
        onClick={() => setConfirming(true)}
      >
        <Archive aria-hidden />
        Archive task
      </Button>
    )
  }

  return (
    <div
      role="group"
      aria-labelledby={`archive-${taskId}`}
      className="space-y-3 rounded-xl border bg-muted/50 p-4"
    >
      <p id={`archive-${taskId}`} className="text-sm">
        Archive this task? It leaves every list. You can restore it from its page or with Undo.
      </p>
      <div className="flex flex-col gap-2 md:flex-row">
        <Button
          ref={confirmRef}
          type="button"
          onClick={archive}
          disabled={pending}
          className="max-md:w-full"
        >
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Archive aria-hidden />}
          {pending ? "Archiving…" : "Yes, archive"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="max-md:w-full"
          onClick={() => {
            returnFocus.current = true
            setConfirming(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Restore (and the archive toast's Undo, which runs after the page has moved on to /tasks). */
export async function restoreArchived(taskId: string): Promise<void> {
  const result = await callTaskAction(() => restoreTask(taskId))
  if (result.status === "error") toast.error(result.message)
  else toast.success("Task restored")
}

/** On an archived task's page. */
export function RestoreTaskButton({ taskId }: { taskId: string }) {
  const [pending, startRestore] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      className="max-md:w-full"
      onClick={() => startRestore(() => restoreArchived(taskId))}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ArchiveRestore aria-hidden />}
      {pending ? "Restoring…" : "Restore task"}
    </Button>
  )
}
