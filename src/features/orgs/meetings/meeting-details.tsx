import type { ReactNode } from "react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip } from "@/components/common/person-chip"
import type { IsoDate } from "@/lib/dates"
import { RatingBadge } from "../list/cells"
import type { MeetingDetail } from "./queries"

/**
 * What was recorded about a meeting: who went (ours and theirs), how it went,
 * notes, concerns, what they asked for and who follows up. Server-safe.
 */
export function MeetingDetails({
  meeting,
  happened,
  followUpSettled,
  today,
}: {
  meeting: MeetingDetail
  happened: boolean
  /** Its follow-up task is done, or we've met them since: the date isn't overdue (red). */
  followUpSettled: boolean
  today: IsoDate
}) {
  return (
    <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      <Item label="Our side">
        {meeting.attendees.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {meeting.attendees.map((person) => (
              <li key={person.id} className="min-w-0">
                <PersonChip person={person} size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <Muted>Nobody recorded</Muted>
        )}
      </Item>
      <Item label="Their side">{meeting.externalAttendees ?? <Muted>Not recorded</Muted>}</Item>
      <Item label="How it went" wide>
        {meeting.rating !== null || meeting.summary ? (
          <span className="flex min-w-0 items-start gap-2">
            {meeting.rating !== null ? (
              <RatingBadge rating={meeting.rating} className="shrink-0" />
            ) : null}
            {meeting.summary ? <span className="min-w-0">{meeting.summary}</span> : null}
          </span>
        ) : (
          <Muted>{happened ? "Not rated yet" : "Rate it after it happens"}</Muted>
        )}
      </Item>
      <Item label="Notes" wide>
        {meeting.notes ? <Text>{meeting.notes}</Text> : <Muted>None</Muted>}
      </Item>
      <Item label="Concerns they raised">
        {meeting.concernsRaised ? <Text>{meeting.concernsRaised}</Text> : <Muted>None</Muted>}
      </Item>
      <Item label="Materials they asked for">
        {meeting.materialsRequested ? (
          <Text>{meeting.materialsRequested}</Text>
        ) : (
          <Muted>None</Muted>
        )}
      </Item>
      <Item label="Follow-up" wide>
        {meeting.followUpOwner && meeting.followUpDate ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PersonChip person={meeting.followUpOwner} size="sm" />
            <DueDate date={meeting.followUpDate} today={today} done={followUpSettled} />
          </span>
        ) : (
          <Muted>No follow-up set</Muted>
        )}
      </Item>
    </dl>
  )
}

function Item({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? "min-w-0 space-y-1 md:col-span-2" : "min-w-0 space-y-1"}>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

function Text({ children }: { children: string }) {
  return <span className="whitespace-pre-line">{children}</span>
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>
}
