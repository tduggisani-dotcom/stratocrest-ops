import type { ReactNode } from "react"
import { TriangleAlert } from "lucide-react"

/**
 * A crunch-period warning box (task form and task page). Neutral on purpose:
 * amber means "stale" and red "overdue" (spec §7); the icon and the words say
 * it's a warning.
 */
export function CrunchNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm text-foreground">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </p>
  )
}
