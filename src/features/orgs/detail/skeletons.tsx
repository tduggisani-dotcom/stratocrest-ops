import { Suspense, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCard } from "@/features/this-week/components/section-card"
import { OrgSectionBoundary } from "./section-boundary"
import { ORG_SECTIONS, type OrgSectionKey } from "./sections"

/**
 * One section's place on the org page: its own error boundary and <Suspense>,
 * so each streams in (and fails) on its own. The fallback is the same card
 * with its heading, so the instant shell already shows what each section is.
 */
export function OrgSectionSlot({
  section,
  rows = 3,
  children,
}: {
  section: OrgSectionKey
  rows?: number
  children: ReactNode
}) {
  return (
    <OrgSectionBoundary section={section}>
      <Suspense fallback={<OrgSectionSkeleton section={section} rows={rows} />}>
        {children}
      </Suspense>
    </OrgSectionBoundary>
  )
}

export function OrgSectionSkeleton({ section, rows }: { section: OrgSectionKey; rows: number }) {
  const { id, title } = ORG_SECTIONS[section]
  return (
    <SectionCard id={id} title={title} busy>
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

/** The org page's header while it loads: name, the facts row and the action buttons. */
export function OrgHeaderSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl md:h-24" />
        <div className="flex flex-col gap-2 md:flex-row">
          <Skeleton className="h-11 w-full md:h-9 md:w-32" />
          <Skeleton className="h-11 w-full md:h-9 md:w-28" />
          <Skeleton className="h-11 w-full md:h-9 md:w-20" />
        </div>
      </div>
    </div>
  )
}

function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className={tall ? "h-16 w-full" : "h-11 w-full md:h-9"} />
    </div>
  )
}

/** The add and edit forms while their choices load. */
export function OrgFormSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading the form…</span>
      <div aria-hidden className="space-y-6">
        <FieldSkeleton />
        <div className="grid gap-6 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <FieldSkeleton tall />
        <FieldSkeleton />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full md:h-9 md:w-32" />
      </div>
    </div>
  )
}
