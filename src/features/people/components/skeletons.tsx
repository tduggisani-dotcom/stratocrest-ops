import { Skeleton } from "@/components/ui/skeleton"

/** /people while the team loads: card placeholders in the same grid. */
export function PeopleGridSkeleton() {
  return (
    <div role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Loading the team…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

/** A profile while it loads: header, then section placeholders. */
export function ProfileSkeleton() {
  return (
    <div role="status" className="space-y-10">
      <span className="sr-only">Loading the profile…</span>
      <div className="flex items-start gap-4">
        <Skeleton className="size-16 rounded-full md:size-20" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3.5 w-full max-w-sm" />
        </div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-full max-w-md" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  )
}
