"use client"

import { useEffect, useRef, type ReactNode } from "react"

/**
 * A heading that takes focus once when it first appears (e.g. "Meeting
 * logged" after the form), so screen-reader and keyboard users start there.
 * Next keeps visited pages alive (React <Activity>) and re-runs effects when a
 * page is shown again; the ref makes sure that doesn't pull focus back.
 */
export function FocusHeading({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLHeadingElement>(null)
  const focused = useRef(false)
  useEffect(() => {
    if (focused.current) return
    focused.current = true
    ref.current?.focus({ preventScroll: false })
  }, [])
  return (
    <h2 ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </h2>
  )
}
