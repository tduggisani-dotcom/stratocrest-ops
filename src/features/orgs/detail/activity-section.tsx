import { Bot, ChevronRight, History, Undo2, Workflow } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/features/this-week/components/section-card"
import { formatDateTime, type IsoDate } from "@/lib/dates"
import { ACTOR_KIND_LABELS } from "@/lib/labels"
import {
  activityWhen,
  describeActivities,
  type ActivityActor,
  type ActivityLine,
} from "../activity"
import { kindConfig, type OrgKind } from "../kind-config"
import { getOrgActivity, HISTORY_LIMIT, HISTORY_PREVIEW } from "../queries/detail"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "./resolve"
import { ORG_SECTIONS } from "./sections"

/**
 * Who changed what, newest first: the org, its meetings and attendees, its
 * hypotheses and evidence, and its debriefs. Bot changes carry a "via Grok"
 * tag; scheduled jobs show as "Automatic". The latest 20 show; the rest of the
 * latest 100 are one tap away.
 */
export async function OrgActivitySection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const id = await orgIdFrom(params)
  const [org, activity] = await Promise.all([orgOrNotFound(kind, id), getOrgActivity(kind, id)])
  const today = requestToday()
  const { id: sectionId, title } = ORG_SECTIONS.history
  const lines = describeActivities(activity.entries, activity.context)

  if (lines.length === 0) {
    return (
      <SectionCard id={sectionId} title={title}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={History}
          title="No history yet"
          description={`Every change to ${org.name}, its meetings, hypotheses and debriefs shows here: who made it and when, including changes made through Grok.`}
        />
      </SectionCard>
    )
  }

  const preview = lines.slice(0, HISTORY_PREVIEW)
  const rest = lines.slice(HISTORY_PREVIEW)
  return (
    <SectionCard
      id={sectionId}
      title={title}
      description={`Changes to this ${kindConfig(kind).singular.toLowerCase()}, its meetings, hypotheses and debriefs.`}
    >
      <ol aria-label={title} className="divide-y">
        {preview.map((line) => (
          <ActivityItem key={line.id} line={line} today={today} />
        ))}
      </ol>
      {rest.length > 0 ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-sm font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9 [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-4 transition-transform group-open:rotate-90"
            />
            <span className="group-open:hidden">Show {rest.length} earlier changes</span>
            <span className="hidden group-open:inline">Hide earlier changes</span>
          </summary>
          <ol aria-label={`${title}: earlier changes`} className="divide-y border-t">
            {rest.map((line) => (
              <ActivityItem key={line.id} line={line} today={today} />
            ))}
          </ol>
          {lines.length >= HISTORY_LIMIT ? (
            <p className="pt-2 text-xs text-muted-foreground">
              Showing the latest {HISTORY_LIMIT} changes.
            </p>
          ) : null}
        </details>
      ) : null}
    </SectionCard>
  )
}

function ActivityItem({ line, today }: { line: ActivityLine; today: IsoDate }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:w-44">
        <Actor actor={line.actor} />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm text-pretty break-words">
          {line.undo ? (
            <Badge variant="outline" className="mr-1.5 align-middle">
              <Undo2 aria-hidden />
              Undo
            </Badge>
          ) : null}
          {line.text}
        </p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={line.occurredAt} title={formatDateTime(line.occurredAt)}>
            {activityWhen(line.occurredAt, today)}
          </time>
        </p>
      </div>
    </li>
  )
}

/** A teammate's chip, "Grok · via Grok" for the bot, or "Automatic" for a scheduled job. */
function Actor({ actor }: { actor: ActivityActor }) {
  if (actor.kind === "person") return <PersonChip person={actor} size="sm" />
  if (actor.kind === "bot") {
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Bot className="size-3.5" />
        </span>
        <span className="truncate text-xs font-medium">{actor.name}</span>
        <Badge variant="secondary">{ACTOR_KIND_LABELS.bot}</Badge>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Workflow className="size-3.5" />
      </span>
      <span className="text-xs font-medium">{ACTOR_KIND_LABELS.system}</span>
    </span>
  )
}
