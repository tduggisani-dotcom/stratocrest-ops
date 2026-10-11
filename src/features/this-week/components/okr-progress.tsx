import Link from "next/link"
import { Target } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import { requireTeamMember } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { krProgress, krProgressText, progressPercent } from "../logic"
import { getOkrProgress, requestClock, type OkrProgress, type WeekKeyResult } from "../queries"
import { MoreLink, SectionCard } from "./section-card"
import { SECTIONS } from "./sections"

type Quarter = OkrProgress["quarter"]

/** "Oct 14 (W2)", or just the date when no session starts the quarter. */
function dayWithWeek(date: string, weekLabel: string | null): string {
  const day = formatDate(date, "short")
  return weekLabel ? `${day} (${weekLabel})` : day
}

/**
 * "This quarter: Q1 · Oct 14 – Jan 13 · share-out Jan 13 (W10)", or before it
 * starts, "Next quarter: Q1 · goals set Oct 14 (W2)".
 */
function quarterLine(q: Quarter): string {
  if (q.status === "upcoming") {
    return `Next quarter: ${q.label} · goals set ${dayWithWeek(q.startDate, q.startWeekLabel)}`
  }
  const range = `${formatDate(q.startDate, "short")} – ${formatDate(q.endDate, "short")}`
  return `This quarter: ${q.label} · ${range} · share-out ${dayWithWeek(q.shareOutDate, q.shareOutWeekLabel)}`
}

/** One key result as an accessible, CSS-only progress bar. Done is green; otherwise the accent. */
function KeyResultBar({ kr }: { kr: WeekKeyResult }) {
  const percent = progressPercent(krProgress(kr))
  const text = krProgressText(kr)
  const labelId = `kr-${kr.id}`
  return (
    <li className="min-w-0 space-y-1.5">
      <div className="flex items-start justify-between gap-3 text-sm">
        <span id={labelId} className="min-w-0 break-words">
          {kr.title}
        </span>
        <span aria-hidden className="shrink-0 font-medium tabular-nums">
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${text} (${percent}%)`}
        className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-border ring-inset"
      >
        <div
          className={cn("h-full rounded-full", percent >= 100 ? "bg-good" : "bg-primary")}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{text}</span>
        <PersonChip person={kr.owner} size="sm" />
      </div>
    </li>
  )
}

/**
 * This quarter's objectives and key results as progress bars (spec §6.8):
 * progress runs from each key result's start value to its target.
 */
export async function OkrProgressSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const okr = await getOkrProgress({ me, today, now })
  const { id, title, icon } = SECTIONS.okrs
  const okrsButton = (
    <Button asChild variant="outline" className="max-md:w-full">
      <Link href="/okrs">Go to OKRs</Link>
    </Button>
  )

  if (!okr) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={Target}
          title="No quarter ahead"
          description="All four Synthe6 quarters have ended. Past objectives and key results are on the OKRs page."
          action={okrsButton}
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  const q = okr.quarter
  if (okr.objectives.length === 0) {
    return (
      <SectionCard id={id} title={title} icon={icon} description={quarterLine(q)}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={Target}
          title={`No OKRs for ${q.label} yet`}
          description={
            q.status === "upcoming"
              ? `OKRs arrive in Stage 5 — goals are set at ${q.startWeekLabel ?? q.label} (${formatDate(q.startDate, "short")}). Each objective's key results will show here as progress bars.`
              : `OKRs arrive in Stage 5 — ${q.label}'s objectives and key results will show here as progress bars.`
          }
          action={okrsButton}
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      id={id}
      title={title}
      icon={icon}
      description={quarterLine(q)}
      action={<MoreLink href="/okrs">OKRs</MoreLink>}
    >
      <ul className="grid gap-6 lg:grid-cols-2 lg:gap-x-8">
        {okr.objectives.map((objective) => (
          <li key={objective.id} className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <h3 className="min-w-0 font-medium break-words">{objective.title}</h3>
              <PersonChip person={objective.owner} size="sm" />
            </div>
            {objective.keyResults.length > 0 ? (
              <ul aria-label={`Key results for ${objective.title}`} className="space-y-4">
                {objective.keyResults.map((kr) => (
                  <KeyResultBar key={kr.id} kr={kr} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No key results yet.</p>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
