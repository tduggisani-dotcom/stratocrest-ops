import Link from "next/link"
import { CalendarX } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { orgListHref } from "@/features/tasks/links"
import { requireTeamMember } from "@/lib/auth"
import { formatDateTime, relativeDay, toEtDate } from "@/lib/dates"
import { orgKindLabels } from "@/lib/labels"
import { meetingPeople, moreCount } from "../logic"
import { getUpcomingOrgMeetings, requestClock } from "../queries"
import { ItemRow, MoreCount, MoreLink, MoreLinks, SectionCard } from "./section-card"
import { SECTIONS } from "./sections"

/**
 * Investor and customer meetings starting in the next 7 days, soonest first,
 * with who from the team is going (or the org's owner when nobody is listed).
 */
export async function OrgMeetingsSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const meetings = await getUpcomingOrgMeetings({ me, today, now })
  const { id, title, icon } = SECTIONS.orgMeetings

  if (meetings.total === 0) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CalendarX}
          title="No investor or customer meetings this week"
          description="Meetings scheduled with investors and customers in the next 7 days show up here, with who from the team is going."
          action={
            <Button asChild variant="outline" className="max-md:w-full">
              <Link href="/investors">Go to investors</Link>
            </Button>
          }
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  const hidden = moreCount(meetings.total, meetings.items.length)

  return (
    <SectionCard
      id={id}
      title={title}
      icon={icon}
      count={{ value: meetings.total, label: meetings.total === 1 ? "meeting" : "meetings" }}
    >
      <div className="min-w-0 space-y-1">
        <ul aria-label={title} className="divide-y">
          {meetings.items.map((meeting) => {
            const { people, isOwnerFallback } = meetingPeople(meeting.attendees, meeting.owner)
            return (
              <ItemRow
                key={meeting.id}
                href={orgListHref(meeting.org.kind)}
                title={meeting.org.name}
              >
                <Badge variant="outline">{orgKindLabels[meeting.org.kind].singular}</Badge>
                <span>
                  <time dateTime={meeting.startsAt}>{formatDateTime(meeting.startsAt)}</time>
                  {" · "}
                  {relativeDay(toEtDate(meeting.startsAt), today)}
                </span>
                <span className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs">{isOwnerFallback ? "Owner:" : "Going:"}</span>
                  {people.map((p) => (
                    <PersonChip key={p.id} person={p} size="sm" />
                  ))}
                </span>
              </ItemRow>
            )
          })}
        </ul>
        {hidden > 0 ? <MoreCount count={hidden} /> : null}
        <MoreLinks>
          <MoreLink href="/investors">Investors</MoreLink>
          <MoreLink href="/customers">Customers</MoreLink>
        </MoreLinks>
      </div>
    </SectionCard>
  )
}
