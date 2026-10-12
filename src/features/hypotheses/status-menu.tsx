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
import { HYPOTHESIS_STATUSES, hypothesisStatusLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { setHypothesisStatus } from "./actions"
import { STATUS_ICONS, statusTone } from "./badges"
import { callHypothesisAction } from "./client-calls"
import type { HypothesisStatus } from "./types"

const STATUS_HINTS: Record<HypothesisStatus, string> = {
  untested: "Not enough evidence yet",
  validated: "The evidence supports it",
  invalidated: "The evidence contradicts it",
}

/**
 * "Status: Untested": a menu that saves on a pick (arrowing through it saves
 * nothing). The new status shows at once; a toast confirms it with Undo, or
 * explains a failure and the menu snaps back. Focus returns to the button.
 *
 * A mouse opens it on press (Radix's default); touch and pen open it on a
 * finished tap, so a scroll that starts on the button doesn't open it.
 */
export function HypothesisStatusMenu({ id, status }: { id: string; status: HypothesisStatus }) {
  const [optimistic, setOptimistic] = useOptimistic(status)
  const [pending, startStatus] = useTransition()
  const [open, setOpen] = useState(false)
  const pointerType = useRef("touch")
  const Icon = STATUS_ICONS[optimistic]

  function pick(value: string) {
    const next = HYPOTHESIS_STATUSES.find((s) => s === value)
    if (!next || next === optimistic) return
    const previous = optimistic
    startStatus(async () => {
      setOptimistic(next)
      await saveStatus(id, next, previous)
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
          className={cn("justify-between gap-2 font-normal max-sm:w-full", statusTone(optimistic))}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Icon aria-hidden />
            <span>
              <span className={optimistic === "validated" ? undefined : "text-muted-foreground"}>
                Status:{" "}
              </span>
              <span className="font-medium">{hypothesisStatusLabels[optimistic]}</span>
            </span>
          </span>
          <ChevronDown aria-hidden className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Mark this hypothesis…
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={optimistic} onValueChange={pick}>
          {HYPOTHESIS_STATUSES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-11 md:min-h-8">
              <span className="flex flex-col">
                <span>{hypothesisStatusLabels[value]}</span>
                <span className="text-xs text-muted-foreground">{STATUS_HINTS[value]}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Saves a status change and says how it went (toast with Undo). */
async function saveStatus(id: string, next: HypothesisStatus, previous: HypothesisStatus) {
  const result = await callHypothesisAction(() => setHypothesisStatus(id, next))
  if (result.status === "error") {
    toast.error(result.message)
    return
  }
  toast.success(`Marked ${hypothesisStatusLabels[next]}`, {
    action: {
      label: "Undo",
      // Runs from the toast, after the page has refreshed.
      onClick: () => startTransition(() => undoStatus(id, previous)),
    },
  })
}

async function undoStatus(id: string, previous: HypothesisStatus) {
  const result = await callHypothesisAction(() => setHypothesisStatus(id, previous))
  if (result.status === "error") toast.error(result.message)
  else toast.success(`Back to ${hypothesisStatusLabels[previous]}`)
}
