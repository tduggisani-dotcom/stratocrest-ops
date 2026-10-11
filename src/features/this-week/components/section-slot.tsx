import { Suspense, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { SectionBoundary } from "./section-boundary"
import { SectionCard } from "./section-card"
import { SECTIONS, type SectionKey } from "./sections"

/**
 * One section's place on the page: its own error boundary and <Suspense>, so
 * every card streams in (and fails) independently. The fallback is the same
 * card with its heading and a few placeholder rows, so the static shell
 * already shows what each card is.
 */
export function SectionSlot({
  section,
  wide = false,
  rows = 3,
  children,
}: {
  section: SectionKey
  /** Span both columns on wide screens. */
  wide?: boolean
  /** Placeholder rows while loading. */
  rows?: number
  children: ReactNode
}) {
  return (
    <div className={cn("min-w-0", wide && "lg:col-span-2")}>
      <SectionBoundary section={section}>
        <Suspense fallback={<SectionSkeleton section={section} rows={rows} />}>{children}</Suspense>
      </SectionBoundary>
    </div>
  )
}

export function SectionSkeleton({ section, rows }: { section: SectionKey; rows: number }) {
  const { id, title, icon } = SECTIONS[section]
  return (
    <SectionCard id={id} title={title} icon={icon} busy>
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
