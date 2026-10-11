import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react"
import type { FormState } from "@/lib/forms"
import { cn } from "@/lib/utils"

/**
 * The whole-form error (red) and any non-blocking warnings from a Server
 * Action. Warnings are neutral with a warning icon: amber means "stale" (spec §7).
 */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  const showError = state.status === "error" && state.message
  const warnings = state.warnings ?? []
  if (!showError && warnings.length === 0) return null
  return (
    <div className={cn("space-y-2", className)}>
      {showError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-overdue-soft px-3 py-2 text-sm text-overdue"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}
      {warnings.map((warning) => (
        <p
          key={warning}
          role="status"
          className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-sm text-foreground"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {warning}
        </p>
      ))}
    </div>
  )
}
