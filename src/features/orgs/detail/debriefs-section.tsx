import Link from "next/link"
import { CalendarPlus, CircleCheck, MessagesSquare } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import { ItemRow, SectionCard } from "@/features/this-week/components/section-card"
import { formatDate, formatDateTime, relativeDay, toEtDate } from "@/lib/dates"
import { kindConfig, type OrgKind } from "../kind-config"
import { meetingHref, newMeetingHref } from "../links"
import { getOrgDebriefs } from "../queries/detail"
import { debriefState } from "./format"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "./resolve"
import { ORG_SECTIONS } from "./sections"

/**
 * One debrief per meeting that has happened (the database opens it, facilitated
 * by the org's owner): what was planned, what happened, what worked, what we'll
 * change. Due ones first; overdue is red, done is green. Each opens its
 * meeting's page, where it's written.
 */
export async function OrgDebriefsSection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const id = await orgIdFrom(params)
  const [org, debriefs] = await Promise.all([orgOrNotFound(kind, id), getOrgDebriefs(id)])
  const today = requestToday()
  const { id: sectionId, title } = ORG_SECTIONS.debriefs
  const noun = kindConfig(kind).singular.toLowerCase()
  const due = debriefs.filter((d) => d.status === "due").length

  if (debriefs.length === 0) {
    return (
      <SectionCard id={sectionId} title={title}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={MessagesSquare}
          title="No debriefs yet"
          description={`After each meeting with this ${noun}, a debrief is opened automatically for its point of contact: what we planned, what happened, what worked, and what we'll change.`}
          action={
            org.archivedAt ? null : (
              <Button asChild variant="outline" className="max-md:w-full">
                <Link href={newMeetingHref(kind, org.id)}>
                  <CalendarPlus aria-hidden />
                  Log a meeting
                </Link>
              </Button>
            )
          }
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      id={sectionId}
      title={title}
      count={due > 0 ? { value: due, label: "due" } : undefined}
    >
      <ul aria-label={title} className="divide-y">
        {debriefs.map((debrief) => {
          const state = debriefState(debrief, today)
          return (
            <ItemRow
              key={debrief.id}
              href={meetingHref(kind, org.id, debrief.meetingId)}
              title={
                <>
                  Meeting on{" "}
                  <time dateTime={debrief.meetingAt}>{formatDateTime(debrief.meetingAt)}</time>
                </>
              }
            >
              {state.kind === "done" ? (
                <span className="inline-flex items-center gap-1 font-medium text-good">
                  <CircleCheck aria-hidden className="size-3.5" />
                  Done
                  {debrief.completedAt
                    ? ` ${formatDate(toEtDate(debrief.completedAt), "short")}`
                    : ""}
                </span>
              ) : state.kind === "overdue" ? (
                <span className="font-medium text-overdue">
                  Due {formatDate(debrief.dueDate, "short")} · overdue{" "}
                  {relativeDay(debrief.dueDate, today)}
                </span>
              ) : (
                <span>
                  Due {formatDate(debrief.dueDate, "short")} · {relativeDay(debrief.dueDate, today)}
                </span>
              )}
              {debrief.facilitator ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="text-xs">Facilitator:</span>
                  <PersonChip person={debrief.facilitator} size="sm" />
                </span>
              ) : (
                <span className="text-xs">No facilitator yet</span>
              )}
            </ItemRow>
          )
        })}
      </ul>
    </SectionCard>
  )
}
