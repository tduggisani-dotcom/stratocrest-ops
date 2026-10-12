import { Skeleton } from "@/components/ui/skeleton"
import { HYPOTHESIS_STATUSES, hypothesisStatusLabels } from "@/lib/labels"

/**
 * Placeholders while the roll-up and a hypothesis's page stream in. The
 * roll-up's three sections keep their names, so the instant shell already
 * shows how the page is organised.
 */

function CardSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  )
}

export function RollupSkeleton() {
  return (
    <div role="status" aria-busy className="space-y-6">
      <span className="sr-only">Loading hypotheses…</span>
      <div aria-hidden className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-24 rounded-full md:h-8" />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-20 rounded-full md:h-8" />
          ))}
        </div>
      </div>
      <div aria-hidden className="grid items-start gap-4 lg:grid-cols-3">
        {HYPOTHESIS_STATUSES.map((status) => (
          <div key={status} className="space-y-3 rounded-xl border bg-muted/40 p-3">
            <p className="px-1 text-base font-semibold text-muted-foreground">
              {hypothesisStatusLabels[status]}
            </p>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ))}
      </div>
    </div>
  )
}

export function HypothesisPageSkeleton() {
  return (
    <div role="status" aria-busy className="space-y-6">
      <span className="sr-only">Loading the hypothesis…</span>
      <div aria-hidden className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-11 w-44 md:h-9" />
          <Skeleton className="h-8 w-11/12" />
          <Skeleton className="h-8 w-2/3" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  )
}
