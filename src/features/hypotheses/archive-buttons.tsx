"use client"

import { startTransition, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { archiveHypothesis, restoreHypothesis } from "./actions"
import { callHypothesisAction } from "./client-calls"
import { focusWhenShown } from "./focus"

const ARCHIVE_BUTTON = "[data-hypothesis-archive]"
const RESTORE_BUTTON = "[data-hypothesis-restore]"

/**
 * Archive in two steps, without a dialog: "Archive", then "Yes, archive" or
 * "Cancel". Hypotheses are never deleted; the page stays (with a banner and
 * Restore), and the toast offers Undo. A failed request shows a toast.
 */
export function ArchiveHypothesisButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startArchive] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  // Next keeps visited pages alive (React <Activity>): come back to the plain button.
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
      const result = await callHypothesisAction(() => archiveHypothesis(id))
      if (result.status === "error") {
        toast.error(result.message)
        return
      }
      toast.success("Hypothesis archived", {
        action: { label: "Undo", onClick: () => startTransition(() => restore(id)) },
      })
      // The banner's Restore button replaces this one.
      focusWhenShown(RESTORE_BUTTON)
    })
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        data-hypothesis-archive=""
        className="max-md:w-full"
        onClick={() => setConfirming(true)}
      >
        <Archive aria-hidden />
        Archive hypothesis
      </Button>
    )
  }

  const labelId = `archive-hypothesis-${id}`
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="space-y-3 rounded-xl border bg-muted/50 p-4"
    >
      <p id={labelId} className="text-sm text-pretty">
        Archive this hypothesis? It leaves the roll-up and its org&apos;s page; its evidence is
        kept. You can restore it from this page or with Undo.
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

async function restore(id: string): Promise<void> {
  const result = await callHypothesisAction(() => restoreHypothesis(id))
  if (result.status === "error") {
    toast.error(result.message)
    return
  }
  toast.success("Hypothesis restored")
  focusWhenShown(ARCHIVE_BUTTON)
}

/** On an archived hypothesis's page. */
export function RestoreHypothesisButton({ id }: { id: string }) {
  const [pending, startRestore] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      data-hypothesis-restore=""
      className="max-md:w-full"
      onClick={() => startRestore(() => restore(id))}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ArchiveRestore aria-hidden />}
      {pending ? "Restoring…" : "Restore hypothesis"}
    </Button>
  )
}
