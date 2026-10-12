import Link from "next/link"
import { CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OrgHypotheses } from "@/features/hypotheses/org-hypotheses"
import { SectionCard } from "@/features/this-week/components/section-card"
import type { OrgKind } from "../kind-config"
import { newMeetingHref } from "../links"
import { MeetingLog } from "../meetings/meeting-log"
import { orgIdFrom, orgOrNotFound, type OrgParams } from "./resolve"
import { ORG_SECTIONS } from "./sections"

/**
 * The meeting log and the hypothesis log, built by their own features. This
 * page gives each its card and h2; the log renders the list (and its own empty
 * state) inside it.
 */
export async function OrgMeetingsSection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const org = await orgOrNotFound(kind, await orgIdFrom(params))
  const { id, title } = ORG_SECTIONS.meetings
  return (
    <SectionCard
      id={id}
      title={title}
      action={
        org.archivedAt ? null : (
          <Button asChild variant="outline">
            <Link href={newMeetingHref(kind, org.id)}>
              <CalendarPlus aria-hidden />
              Log meeting
            </Link>
          </Button>
        )
      }
    >
      <MeetingLog kind={kind} orgId={org.id} orgName={org.name} />
    </SectionCard>
  )
}

export async function OrgHypothesesSection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const org = await orgOrNotFound(kind, await orgIdFrom(params))
  const { id, title } = ORG_SECTIONS.hypotheses
  return (
    <SectionCard id={id} title={title}>
      <OrgHypotheses kind={kind} orgId={org.id} orgName={org.name} />
    </SectionCard>
  )
}
