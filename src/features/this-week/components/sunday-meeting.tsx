import Link from "next/link"
import { CalendarX } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import { requireTeamMember } from "@/lib/auth"
import { formatDate, formatTime, relativeDay } from "@/lib/dates"
import { sentenceCase } from "../logic"
import { getNextSundayMeeting, requestClock, type TeamPerson } from "../queries"
import { MoreLink, SectionCard } from "./section-card"
import { SECTIONS } from "./sections"

/** A labelled row of teammates (avatar + name), or one line when there's nobody. */
function PeopleRow({
  id,
  label,
  people,
  empty,
}: {
  id: string
  label: string
  people: TeamPerson[]
  empty: string
}) {
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-xs font-medium text-muted-foreground">
        {label} <span className="tabular-nums">({people.length})</span>
      </p>
      {people.length > 0 ? (
        <ul aria-labelledby={id} className="flex flex-wrap gap-x-4 gap-y-2">
          {people.map((p) => (
            <li key={p.id} className="min-w-0 max-w-full">
              <PersonChip person={p} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

/**
 * The next Sunday meeting (spec §6.6): when, who's facilitating, and who has
 * and hasn't posted their written pre-meeting update.
 */
export async function SundayMeetingSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const meeting = await getNextSundayMeeting({ me, today, now })
  const { id, title, icon } = SECTIONS.sundayMeeting

  if (!meeting) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CalendarX}
          title="No Sunday meeting scheduled"
          description="Next Sunday's meeting is created automatically, with the facilitator rotating through the team. It shows here with who has posted their update."
          action={
            <Button asChild variant="outline" className="max-md:w-full">
              <Link href="/meetings">Go to meetings</Link>
            </Button>
          }
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  const teamSize = meeting.posted.length + meeting.notPosted.length
  const iHaveNotPosted = meeting.notPosted.some((p) => p.id === me.id)

  return (
    <SectionCard
      id={id}
      title={title}
      icon={icon}
      action={<MoreLink href="/meetings">Meetings</MoreLink>}
    >
      <div className="space-y-1">
        <p className="text-lg font-semibold tracking-tight">
          <time dateTime={meeting.startsAt}>
            {formatDate(meeting.meetingDate, "medium")} · {formatTime(meeting.startsAt)}
          </time>
        </p>
        <p className="text-sm font-medium">
          {sentenceCase(relativeDay(meeting.meetingDate, today))}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Facilitating</p>
        <PersonChip person={meeting.facilitator} />
      </div>

      <div className="space-y-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">Pre-meeting updates</h3>
          <p className="text-sm text-muted-foreground">
            {meeting.posted.length} of {teamSize} posted
            {iHaveNotPosted ? " · you haven't posted yours yet" : null}
          </p>
        </div>
        <PeopleRow
          id="sunday-meeting-posted"
          label="Posted"
          people={meeting.posted}
          empty="Nobody has posted yet."
        />
        <PeopleRow
          id="sunday-meeting-not-posted"
          label="Not posted yet"
          people={meeting.notPosted}
          empty="Everyone has posted."
        />
      </div>
    </SectionCard>
  )
}
