"use client"

import { startTransition, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { archiveOrg, restoreOrg } from "../actions"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgListHref } from "../links"
import { callOrgAction } from "./client-calls"

/**
 * Archive in two steps, without a dialog: "Archive", then "Yes, archive" or
 * "Cancel". Orgs are never deleted; the toast offers Undo, and an archived
 * org's page has Restore. A failed request shows a toast and keeps the page.
 */
export function ArchiveOrgButton({
  kind,
  orgId,
  name,
}: {
  kind: OrgKind
  orgId: string
  name: string
}) {
  const router = useRouter()
  const { singular } = kindConfig(kind)
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
      const result = await callOrgAction(() => archiveOrg(orgId))
      if (result.status === "error") {
        toast.error(result.message)
        return
      }
      toast.success(`${singular} archived`, {
        description: name,
        action: {
          label: "Undo",
          onClick: () => startTransition(() => restoreArchived(kind, orgId)),
        },
      })
      router.push(orgListHref(kind))
    })
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        className="max-md:w-full"
        onClick={() => setConfirming(true)}
      >
        <Archive aria-hidden />
        Archive
      </Button>
    )
  }

  return (
    <div
      role="group"
      aria-labelledby={`archive-${orgId}`}
      className="basis-full space-y-3 rounded-xl border bg-muted/50 p-4"
    >
      <p id={`archive-${orgId}`} className="text-sm text-pretty">
        Archive {name}? It leaves the {kindConfig(kind).plural.toLowerCase()} list and the board,
        and its history is kept. You can restore it from its page or with Undo.
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

/** Restore (and the archive toast's Undo, which runs after the page has moved on to the list). */
async function restoreArchived(kind: OrgKind, orgId: string): Promise<void> {
  const result = await callOrgAction(() => restoreOrg(orgId))
  if (result.status === "error") toast.error(result.message)
  else toast.success(`${kindConfig(kind).singular} restored`)
}

/** On an archived org's page. */
export function RestoreOrgButton({ kind, orgId }: { kind: OrgKind; orgId: string }) {
  const [pending, startRestore] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      className="max-md:w-full"
      onClick={() => startRestore(() => restoreArchived(kind, orgId))}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ArchiveRestore aria-hidden />}
      {pending ? "Restoring…" : `Restore ${kindConfig(kind).singular.toLowerCase()}`}
    </Button>
  )
}
