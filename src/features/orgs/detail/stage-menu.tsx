"use client"

import { startTransition, useOptimistic, useRef, useState, useTransition } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import { changeOrgStage } from "../stage-actions"
import { callOrgAction } from "./client-calls"

/**
 * "Stage: Meeting": a menu of the kind's stages that saves on a pick (arrowing
 * through it saves nothing). The new stage shows at once; a toast confirms it
 * with Undo (which moves it back), or explains a failure and the menu snaps
 * back. Focus returns to the button after a pick.
 *
 * A mouse opens it on press (Radix's default); touch and pen open it on a
 * finished tap, so a scroll that starts on the button doesn't open the menu.
 */
export function OrgStageMenu({
  kind,
  orgId,
  orgName,
  stage,
}: {
  kind: OrgKind
  orgId: string
  orgName: string
  stage: string
}) {
  const { stages } = kindConfig(kind)
  const [optimistic, setOptimistic] = useOptimistic(stage)
  const [pending, startStageTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const pointerType = useRef("touch")
  const current = stages.find((s) => s.value === optimistic)

  function pick(next: string) {
    if (next === optimistic) return
    const previous = optimistic
    startStageTransition(async () => {
      setOptimistic(next)
      await saveStage(kind, orgId, orgName, next, previous)
    })
  }

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
          aria-busy={pending || undefined}
          className="justify-between gap-3 font-normal max-sm:w-full"
        >
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">Stage: </span>
            <span className={cn("font-medium", current?.outcome === "won" && "text-good")}>
              {current?.label ?? optimistic}
            </span>
          </span>
          <ChevronDown aria-hidden className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      {/* Capped, so a long name wraps instead of pushing the menu off a phone screen. */}
      <DropdownMenuContent align="start" className="max-w-72 min-w-48">
        <DropdownMenuLabel className="text-xs font-normal break-words text-muted-foreground">
          Move {orgName} to…
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={optimistic} onValueChange={pick}>
          {stages.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value} className="min-h-11 md:min-h-8">
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function stageLabel(kind: OrgKind, stage: string): string {
  return kindConfig(kind).stages.find((s) => s.value === stage)?.label ?? stage
}

/** Saves a stage change and says how it went (toast with Undo). True when it saved. */
async function saveStage(
  kind: OrgKind,
  orgId: string,
  orgName: string,
  next: string,
  previous: string,
): Promise<boolean> {
  const result = await callOrgAction(() => changeOrgStage(orgId, next))
  if (result.status === "error") {
    toast.error(result.message)
    return false
  }
  toast.success(`Moved to ${stageLabel(kind, next)}`, {
    description: orgName,
    action: {
      label: "Undo",
      // Runs from the toast, after the page has refreshed.
      onClick: () => startTransition(() => undoStage(kind, orgId, previous)),
    },
  })
  return true
}

async function undoStage(kind: OrgKind, orgId: string, previous: string): Promise<void> {
  const result = await callOrgAction(() => changeOrgStage(orgId, previous))
  if (result.status === "error") toast.error(result.message)
  else toast.success(`Back to ${stageLabel(kind, previous)}`)
}
