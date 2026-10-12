import type { ReactNode } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import type { OrgSummary } from "../queries/list"

/**
 * The numbers above the list (spec §6.2): total, meetings this month,
 * average rating and follow-ups due this week, then a count per stage. They
 * describe the current filtered view. Wraps to two columns on phones.
 */
export function SummaryBar({
  kind,
  summary,
  overdueFollowUps,
}: {
  kind: OrgKind
  summary: OrgSummary
  /** Of the follow-ups due this week, how many are already late (shown in red). */
  overdueFollowUps: number
}) {
  const config = kindConfig(kind)
  return (
    <section
      aria-labelledby={`org-${kind}-summary`}
      className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground"
    >
      <h2 id={`org-${kind}-summary`} className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label={summary.total === 1 ? config.singular : config.plural}>{summary.total}</Stat>
        <Stat label="Meetings this month">{summary.meetingsThisMonth}</Stat>
        <Stat label="Average rating">
          {summary.averageRating !== null ? (
            <span className="inline-flex items-center gap-1">
              <Star aria-hidden className="size-4 fill-current text-muted-foreground" />
              {summary.averageRating.toFixed(1)}
              <span className="sr-only"> out of 5</span>
            </span>
          ) : (
            <span className="text-base font-normal text-muted-foreground">No ratings yet</span>
          )}
        </Stat>
        <Stat
          label="Follow-ups due this week"
          detail={
            overdueFollowUps > 0 ? (
              <span className="font-medium text-overdue">{overdueFollowUps} overdue</span>
            ) : null
          }
        >
          {summary.followUpsDueThisWeek}
        </Stat>
      </dl>
      <ul aria-label="By stage" className="flex flex-wrap gap-1.5">
        {summary.byStage.map((stage) => (
          <li
            key={stage.stage}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
              stage.count === 0 && "text-muted-foreground",
            )}
          >
            {stage.label}
            <span className="font-semibold tabular-nums">{stage.count}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({
  label,
  detail,
  children,
}: {
  label: string
  detail?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{children}</dd>
      {detail ? <dd className="text-xs">{detail}</dd> : null}
    </div>
  )
}
