import type { ReactNode } from "react"
import Link from "next/link"
import { Archive, CalendarPlus, Clock, Pencil, Plus } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { newTaskHref } from "@/features/tasks/links"
import { staleLabel } from "@/features/this-week/logic"
import { formatDate, relativeDay } from "@/lib/dates"
import { orgSubtypeLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { kindConfig, OWNER_LABEL, type OrgKind } from "../kind-config"
import { editOrgHref, newMeetingHref, orgHref } from "../links"
import { ArchiveOrgButton, RestoreOrgButton } from "./archive-buttons"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "./resolve"
import { OrgStageMenu } from "./stage-menu"

/**
 * The top of an org page: name, kind and type, then the facts that answer
 * "what do I need to do?": stage (changeable in place), the point of contact,
 * the next step and its date (red when overdue), and last contact (amber when
 * stale). Then the actions: Log meeting, Add task, Edit, Archive. An archived
 * org shows a banner with Restore instead of the actions.
 */
export async function OrgHeader({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const org = await orgOrNotFound(kind, await orgIdFrom(params))
  const today = requestToday()
  const config = kindConfig(kind)
  const archived = org.archivedAt !== null
  const open = org.stageOutcome === "open"

  return (
    <header className="space-y-4">
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{config.singular}</Badge>
          {org.subtype ? <Badge variant="secondary">{orgSubtypeLabels[org.subtype]}</Badge> : null}
          {archived ? (
            <Badge variant="secondary">
              <Archive aria-hidden />
              Archived
            </Badge>
          ) : null}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
          {org.name}
        </h1>
      </div>

      {archived ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border bg-muted/50 p-4 md:flex-row md:items-center md:justify-between"
        >
          <p className="flex items-start gap-2 text-sm">
            <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">Archived.</span> This {config.singular.toLowerCase()}{" "}
              doesn&apos;t appear in the list or on the board. Restore it to edit it, change its
              stage or log a meeting.
            </span>
          </p>
          <RestoreOrgButton kind={kind} orgId={org.id} />
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-8">
        <Fact label="Stage">
          {archived ? (
            <span className="text-sm font-medium">{org.stageLabel}</span>
          ) : (
            <OrgStageMenu kind={kind} orgId={org.id} orgName={org.name} stage={org.stage} />
          )}
        </Fact>
        <Fact label={OWNER_LABEL}>
          <PersonChip
            person={{
              name: org.owner.isActive ? org.owner.name : `${org.owner.name} (former teammate)`,
              avatarUrl: org.owner.avatarUrl,
              role: org.owner.role,
            }}
            showRole
          />
        </Fact>
        <Fact label="Next step" className="sm:col-span-2 lg:col-span-1">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium text-pretty break-words">{org.nextStep}</span>
            <DueDate date={org.nextStepDate} today={today} done={!open || archived} />
          </span>
        </Fact>
        <Fact label="Last contact">
          <span className="flex min-w-0 flex-col gap-0.5 text-sm">
            {org.lastContactDate ? (
              <span>
                <time dateTime={org.lastContactDate}>
                  {formatDate(org.lastContactDate, "short")}
                </time>{" "}
                <span className="text-muted-foreground">
                  · {relativeDay(org.lastContactDate, today)}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">No contact yet</span>
            )}
            {org.isStale && !archived ? (
              <span className="inline-flex items-center gap-1 font-medium text-stale">
                <Clock aria-hidden className="size-3.5" />
                {staleLabel(org.daysSinceContact, org.lastContactDate)}
              </span>
            ) : null}
          </span>
        </Fact>
      </dl>

      {archived ? null : (
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-start">
          <Button asChild>
            <Link href={newMeetingHref(kind, org.id)}>
              <CalendarPlus aria-hidden />
              Log meeting
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href={newTaskHref({
                org: org.id,
                owner: org.owner.isActive ? org.owner.id : undefined,
                returnTo: orgHref(kind, org.id),
              })}
            >
              <Plus aria-hidden />
              Add task
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={editOrgHref(kind, org.id)}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
          <ArchiveOrgButton kind={kind} orgId={org.id} name={org.name} />
        </div>
      )}
    </header>
  )
}

function Fact({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-h-9 min-w-0 items-center">{children}</dd>
    </div>
  )
}
