"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Holds the debrief form. While the debrief is due, the form shows as it is;
 * once it's done, the form folds away under "Edit or reopen".
 *
 * The form stays at the same place in the tree either way, so marking a
 * debrief done doesn't remount it: its result (the "Debrief marked done" toast)
 * is still handled. When it folds away with focus inside (the button that was
 * pressed), focus moves to the toggle instead of being lost.
 */
export function DebriefDisclosure({
  collapsed,
  children,
}: {
  /** True once the debrief is done. */
  collapsed: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Start folded each time the debrief becomes done (adjusting state while rendering).
  const [wasCollapsed, setWasCollapsed] = useState(collapsed)
  if (wasCollapsed !== collapsed) {
    setWasCollapsed(collapsed)
    setOpen(false)
  }

  const contentId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previous = useRef(collapsed)
  useEffect(() => {
    // Only on the change itself (effects also re-run when Activity shows the page again).
    if (previous.current === collapsed) return
    previous.current = collapsed
    if (!collapsed) return
    const active = document.activeElement
    if (active === null || active === document.body || contentRef.current?.contains(active)) {
      toggleRef.current?.focus()
    }
  }, [collapsed])

  const hidden = collapsed && !open
  return (
    <div className={cn(collapsed && "rounded-xl border")}>
      {collapsed ? (
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-2 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
          />
          Edit or reopen
        </button>
      ) : null}
      <div
        ref={contentRef}
        id={contentId}
        hidden={hidden}
        className={cn(collapsed && "border-t p-4")}
      >
        {children}
      </div>
    </div>
  )
}
