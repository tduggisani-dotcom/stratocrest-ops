import Link from "next/link"
import { CalendarPlus, CircleCheck, MessagesSquare } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import { ItemRow } from "@/features/this-week/components/section-card"
import { requireTeamMember } from "@/lib/auth"
import { formatDateTime, type IsoDate } from "@/lib/dates"
import { requestToday } from "../detail/resolve"
import { kindConfig, type OrgKind } from "../kind-config"
import { RatingBadge } from "../list/cells"
import { meetingHref, newMeetingHref } from "../links"
import { splitMeetings } from "./helpers"
import { getMeetingLog, getMeetingOrg, type MeetingLogEntry } from "./queries"

/** How many of our attendees a row shows before "+N". */
const SHOWN_ATTENDEES = 3

/**
 * The org page's meeting log (spec §6.2): scheduled meetings on top (the next
 * one first), then the ones that happened, newest first. Each row shows when,
 * who went (ours and theirs), the rating and one-line summary, the follow-up,
 * and the debrief's status, and opens the meeting's page. The org page gives
 * it its card and h2; headings here are h3. Rendered inside the page's Suspense.
 */
export async function MeetingLog({
  kind,
  orgId,
  orgName,
}: {
  kind: OrgKind
  orgId: string
  orgName: string
}) {
  await requireTeamMember()
  const [meetings, org] = await Promise.all([getMeetingLog(orgId), getMeetingOrg(kind, orgId)])
  const today = requestToday()

  if (meetings.length === 0) {
    const noun = kindConfig(kind).singular.toLowerCase()
    return (
      <EmptyState
        size="compact"
        titleAs="h3"
        icon={MessagesSquare}
        title="No meetings logged yet"
        description={`Log each meeting with ${orgName}: who went, how it went (1–5 and one line), what they asked for, and who follows up. Then write a short debrief. Scheduled meetings with this ${noun} can be logged ahead of time.`}
        action={
          org && !org.archivedAt ? (
            <Button asChild variant="outline" className="max-md:w-full">
              <Link href={newMeetingHref(kind, orgId)}>
                <CalendarPlus aria-hidden />
                Log the first meeting
              </Link>
            </Button>
          ) : null
        }
      />
    )
  }

  // One clock for the whole log (this component renders inside the page's Suspense).
  const { scheduled, past } = splitMeetings(meetings, new Date())
  const groups = [
    { id: `meetings-${orgId}-scheduled`, title: "Scheduled", items: scheduled, happened: false },
    { id: `meetings-${orgId}-past`, title: "Past meetings", items: past, happened: true },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id} className="min-w-0 space-y-1">
          {/* With only past meetings, the card's "Meetings" heading says it all. */}
          {scheduled.length > 0 ? (
            <h3 id={group.id} className="text-sm font-semibold">
              {group.title}
            </h3>
          ) : null}
          <ul
            aria-labelledby={scheduled.length > 0 ? group.id : undefined}
            aria-label={scheduled.length > 0 ? undefined : "Meetings"}
            className="divide-y"
          >
            {group.items.map((meeting, index) => (
              <MeetingRow
                key={meeting.id}
                kind={kind}
                orgId={orgId}
                meeting={meeting}
                happened={group.happened}
                // Past meetings are newest first: every one but the first has been followed by another.
                followUpSettled={meeting.followUpTaskDone || (group.happened && index > 0)}
                today={today}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function MeetingRow({
  kind,
  orgId,
  meeting,
  happened,
  followUpSettled,
  today,
}: {
  kind: OrgKind
  orgId: string
  meeting: MeetingLogEntry
  happened: boolean
  /** Its follow-up task is done, or we've met them since: the date isn't overdue (red). */
  followUpSettled: boolean
  today: IsoDate
}) {
  const shown = meeting.attendees.slice(0, SHOWN_ATTENDEES)
  const more = meeting.attendees.length - shown.length
  return (
    <ItemRow
      href={meetingHref(kind, orgId, meeting.id)}
      title={<time dateTime={meeting.startsAt}>{formatDateTime(meeting.startsAt)}</time>}
      detail={
        meeting.rating !== null || meeting.summary ? (
          <span className="flex min-w-0 items-start gap-2">
            {meeting.rating !== null ? (
              <RatingBadge rating={meeting.rating} className="shrink-0" />
            ) : null}
            {meeting.summary ? <span className="min-w-0">{meeting.summary}</span> : null}
          </span>
        ) : happened ? (
          "Not rated yet"
        ) : null
      }
    >
      {shown.length > 0 ? (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="sr-only">Our side:</span>
          {shown.map((person) => (
            <PersonChip key={person.id} person={person} size="sm" />
          ))}
          {more > 0 ? <span className="text-xs">+{more}</span> : null}
        </span>
      ) : null}
      {meeting.externalAttendees ? (
        <span className="max-w-full min-w-0 truncate">
          <span className="sr-only">Their side: </span>
          with {meeting.externalAttendees}
        </span>
      ) : null}
      {meeting.followUpOwner && meeting.followUpDate ? (
        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-xs">Follow-up:</span>
          <PersonChip person={meeting.followUpOwner} size="sm" />
          <DueDate date={meeting.followUpDate} today={today} done={followUpSettled} />
        </span>
      ) : null}
      <DebriefStatusText debrief={meeting.debrief} today={today} />
    </ItemRow>
  )
}

/** "Debrief done" (green), "Debrief due Oct 12 · overdue …" (red when late), or nothing yet. */
function DebriefStatusText({
  debrief,
  today,
}: {
  debrief: MeetingLogEntry["debrief"]
  today: IsoDate
}) {
  if (!debrief) return null
  if (debrief.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-good">
        <CircleCheck aria-hidden className="size-3.5" />
        Debrief done
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      Debrief due
      <DueDate date={debrief.dueDate} today={today} />
    </span>
  )
}
