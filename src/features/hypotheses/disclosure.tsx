"use client"

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { findShown, focusWhenShown } from "./focus"

/**
 * An inline form behind a button ("Add hypothesis", "Add evidence", "Edit"),
 * without a dialog. Any number of toggles in the same scope open the one
 * panel (e.g. the button above a list and the one in its empty state). The
 * panel stays mounted while closed, so a half-typed form survives a misclick.
 *
 * Focus: opening moves it to the panel's first field; Cancel returns it to
 * the button that opened the panel; after a save the form asks for the new
 * item (falling back to that button). Next keeps visited pages alive (React
 * <Activity>) and re-runs effects when one is shown again, so each focus
 * request is handled once.
 */

type CloseOptions = {
  /** A selector for what to focus after closing (e.g. the item just added). */
  focus?: string
}

type DisclosureApi = {
  open: boolean
  panelId: string
  toggle: (opener: HTMLElement) => void
  close: (options?: CloseOptions) => void
}

type FocusRequest = { kind: "panel" } | { kind: "after-close"; focus?: string }

const DisclosureContext = createContext<DisclosureApi | null>(null)

/** The forms call this to close their panel (after a save, or on Cancel). Null outside a panel. */
export function useDisclosure(): DisclosureApi | null {
  return useContext(DisclosureContext)
}

const FIRST_FIELD =
  'textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled])'

/** True when `element` is in the page and shown (not inside a hidden panel). */
function focusable(element: HTMLElement | null | undefined): element is HTMLElement {
  return Boolean(element?.isConnected && element.getClientRects().length > 0)
}

export function DisclosureScope({
  defaultOpen = false,
  children,
}: {
  /** Open on arrival (e.g. /hypotheses?add=1). Turning it on later opens the panel again. */
  defaultOpen?: boolean
  children: ReactNode
}) {
  const panelId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [request, setRequest] = useState<FocusRequest | null>(
    defaultOpen ? { kind: "panel" } : null,
  )
  const opener = useRef<HTMLElement | null>(null)
  const handled = useRef<FocusRequest | null>(null)

  // A link to ?add=1 while the page is already showing opens the panel.
  const [lastDefault, setLastDefault] = useState(defaultOpen)
  if (lastDefault !== defaultOpen) {
    setLastDefault(defaultOpen)
    if (defaultOpen && !open) {
      setOpen(true)
      setRequest({ kind: "panel" })
    }
  }

  useEffect(() => {
    if (!request || handled.current === request) return
    handled.current = request
    if (request.kind === "panel") {
      document.getElementById(panelId)?.querySelector<HTMLElement>(FIRST_FIELD)?.focus()
      return
    }
    const back = () => {
      const fallback = focusable(opener.current)
        ? opener.current
        : findShown(`[aria-controls="${CSS.escape(panelId)}"]`)
      fallback?.focus()
    }
    if (!request.focus) {
      back()
      return
    }
    // The saved item can arrive with the refreshed page a frame or two later.
    return focusWhenShown(request.focus, back)
  }, [request, panelId])

  const api: DisclosureApi = {
    open,
    panelId,
    toggle(element) {
      // Closing with the same button leaves focus on it.
      if (!open) {
        opener.current = element
        setRequest({ kind: "panel" })
      }
      setOpen(!open)
    },
    close(options = {}) {
      setRequest({ kind: "after-close", focus: options.focus })
      setOpen(false)
    },
  }

  return <DisclosureContext.Provider value={api}>{children}</DisclosureContext.Provider>
}

/** A button that opens (or closes) the scope's panel. */
export function DisclosureToggle({
  children,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-expanded" | "aria-controls" | "type">) {
  const api = useDisclosure()
  if (!api) throw new Error("DisclosureToggle must be inside a DisclosureScope")
  return (
    <Button
      type="button"
      aria-expanded={api.open}
      aria-controls={api.panelId}
      onClick={(event) => {
        onClick?.(event)
        api.toggle(event.currentTarget)
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

/** The panel: a labelled region, hidden (but kept) while closed. */
export function DisclosurePanel({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  const api = useDisclosure()
  if (!api) throw new Error("DisclosurePanel must be inside a DisclosureScope")
  return (
    <div
      id={api.panelId}
      role="region"
      aria-label={label}
      hidden={!api.open}
      className={cn("rounded-xl border bg-muted/30 p-4", className)}
    >
      {children}
    </div>
  )
}
