import { Skeleton } from "@/components/ui/skeleton"
import { kindConfig, type OrgKind } from "../kind-config"

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-4 px-3 py-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-5 w-10 rounded-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

/** The list while the session and the orgs load: the controls, the summary and a few rows. */
export function OrgListSkeleton({ kind }: { kind: OrgKind }) {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading {kindConfig(kind).plural.toLowerCase()}…</span>
      <div aria-hidden className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-[52px] w-44 rounded-lg md:h-10" />
          <Skeleton className="h-11 w-40 md:h-9" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl sm:h-28" />
        <Skeleton className="h-11 w-full md:h-9 md:max-w-sm" />
        <Skeleton className="hidden h-40 w-full rounded-xl md:block" />
        <div className="hidden divide-y rounded-xl border bg-card md:block">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
        <div className="space-y-3 md:hidden">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  )
}
