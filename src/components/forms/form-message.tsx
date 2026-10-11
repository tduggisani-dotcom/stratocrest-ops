import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react"
import type { FormState } from "@/lib/forms"
import { cn } from "@/lib/utils"

/** The whole-form error and any non-blocking warnings from a Server Action. */
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
          className="flex items-start gap-2 rounded-md border border-stale/40 bg-stale-soft px-3 py-2 text-sm text-stale"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ))}
    </div>
  )
}
