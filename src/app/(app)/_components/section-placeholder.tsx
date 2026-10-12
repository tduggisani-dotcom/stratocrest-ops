import { Suspense } from "react"
import { Plus } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { navItem, type NavHref } from "@/components/shell/nav-config"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireTeamMember } from "@/lib/auth"

type PlaceholderProps = {
  href: NavHref
  /** Empty-state heading, e.g. "No investors yet". */
  emptyTitle: string
  /** What will live here, in a sentence or two. */
  emptyDescription: string
  /** The first-item button, e.g. "Add your first investor". */
  actionLabel: string
}

/**
 * Stage 1 stand-in for a section that a later stage builds: the real page
 * header, then an empty state that says what will live here and when, with
 * the first-item button in place but not yet working.
 *
 * The header is static (instant); the body checks the session behind Suspense.
 */
export function SectionPlaceholder(props: PlaceholderProps) {
  const section = navItem(props.href)
  return (
    <>
      <PageHeader title={section.label} description={section.description} />
      <Suspense fallback={<EmptyStateSkeleton />}>
        <PlaceholderBody {...props} />
      </Suspense>
    </>
  )
}

async function PlaceholderBody({
  href,
  emptyTitle,
  emptyDescription,
  actionLabel,
}: PlaceholderProps) {
  await requireTeamMember()
  const section = navItem(href)
  const noteId = `coming-soon-${href.slice(1) || "home"}`
  return (
    <EmptyState
      icon={section.icon}
      title={emptyTitle}
      description={emptyDescription}
      action={<ComingSoonButton label={actionLabel} stage={section.stage} noteId={noteId} />}
    />
  )
}

/**
 * A first-item button that isn't wired up yet. `aria-disabled` (not
 * `disabled`) keeps it focusable, so keyboard and screen reader users still
 * find it and hear the "Coming in Stage N" note.
 */
export function ComingSoonButton({
  label,
  stage,
  noteId,
}: {
  label: string
  stage: number
  noteId: string
}) {
  return (
    <>
      <Button
        type="button"
        aria-disabled="true"
        aria-describedby={noteId}
        className="cursor-not-allowed opacity-60 hover:bg-primary max-md:w-full"
      >
        <Plus aria-hidden />
        {label}
      </Button>
      <p id={noteId} className="text-xs text-muted-foreground">
        Coming in Stage {stage}
      </p>
    </>
  )
}

export function EmptyStateSkeleton() {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 md:py-14"
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="size-12 rounded-full" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3.5 w-full max-w-sm" />
      <Skeleton className="h-3.5 w-3/4 max-w-xs" />
      <Skeleton className="mt-2 h-11 w-full rounded-md md:h-9 md:w-52" />
    </div>
  )
}
