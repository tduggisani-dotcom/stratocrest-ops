import { Clock } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { Badge } from "@/components/ui/badge"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { OrgListItem } from "../queries/list"
import { isClosed, meetingDates, ratingText, ratingTone, staleText } from "./display"

/**
 * The pieces of an org row that the table and the phone cards share, so both
 * show the same rating colours, dates and markers. Server-safe (no hooks).
 */

/** For an empty cell: a dash people see and "Not set" for screen readers. */
export function Missing({ label = "Not set" }: { label?: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** "4/5": green only for a strong rating (4–5), neutral otherwise. */
export function RatingBadge({ rating, className }: { rating: number; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "tabular-nums",
        ratingTone(rating) === "good" && "bg-good-soft text-good",
        className,
      )}
    >
      <span aria-hidden>{ratingText(rating)}</span>
      <span className="sr-only">Rated {rating} out of 5</span>
    </Badge>
  )
}

/** How the latest meeting went: its rating and one-line summary. */
export function HowItWent({
  org,
  className,
}: {
  org: Pick<OrgListItem, "latest_rating" | "latest_summary">
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
      {org.latest_rating !== null ? (
        <RatingBadge rating={org.latest_rating} />
      ) : (
        <span className="text-sm text-muted-foreground">Not rated</span>
      )}
      {org.latest_summary ? (
        <p title={org.latest_summary} className="line-clamp-2 text-sm break-words">
          {org.latest_summary}
        </p>
      ) : null}
    </div>
  )
}

/** Latest meeting ("Oct 3 · 9 days ago") and the next one ("Next: Oct 20, 2:00 PM"). */
export function MeetingDatesText({
  org,
  today,
}: {
  org: Pick<OrgListItem, "latest_meeting_at" | "next_meeting_at">
  today: IsoDate
}) {
  const { latest, next } = meetingDates(org, today)
  if (!latest && !next)
    return <span className="text-sm text-muted-foreground">No meetings yet</span>
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      {latest ? (
        <span>
          <span className="sr-only">Latest: </span>
          <time dateTime={latest.date}>{latest.label}</time>
          <span className="text-muted-foreground"> · {latest.relative}</span>
        </span>
      ) : null}
      {next ? (
        <span>
          <span className="text-muted-foreground">Next: </span>
          <time dateTime={next.at} title={next.relative}>
            {next.label}
          </time>
        </span>
      ) : null}
    </div>
  )
}

/** The amber "No contact in N days" marker (amber is only ever used for this). */
export function StaleMarker({
  org,
}: {
  org: Pick<OrgListItem, "is_stale" | "days_since_contact" | "last_contact_date">
}) {
  const text = staleText(org)
  if (!text) return null
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-stale-soft px-2 py-0.5 text-xs font-medium text-stale">
      <Clock aria-hidden className="size-3" />
      {text}
    </span>
  )
}

/** The next step, its date (red when overdue) and the stale marker. */
export function NextStep({
  org,
  today,
}: {
  org: Pick<
    OrgListItem,
    | "next_step"
    | "next_step_date"
    | "stage_outcome"
    | "is_stale"
    | "days_since_contact"
    | "last_contact_date"
  >
  today: IsoDate
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      {org.next_step ? (
        <p title={org.next_step} className="line-clamp-2 text-sm break-words">
          {org.next_step}
        </p>
      ) : null}
      {org.next_step_date ? (
        // A won or lost org has no follow-up, so its date is never "overdue".
        <DueDate date={org.next_step_date} today={today} done={isClosed(org)} />
      ) : null}
      <StaleMarker org={org} />
    </div>
  )
}
