import { APP_TIME_ZONE, etMoment, formatDate, isIsoDate, toEtDate, type IsoDate } from "@/lib/dates"
import { TASK_LIMITS } from "@/lib/schemas/tasks"

/**
 * Pure helpers for logging and showing org meetings (unit-tested in
 * helpers.test.ts). No server-only imports: the meeting form uses some of them.
 */

const etClock = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** "14:05": the ET wall-clock time of a moment, as <input type="time"> holds it. */
export function etTimeOf(instant: Date | string): string {
  const parts = etClock.formatToParts(new Date(instant))
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00"
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00"
  return `${hour}:${minute}`
}

/**
 * The new-meeting form's default day and time: now in ET, rounded DOWN to the
 * quarter hour (10:07 -> 10:00). Never in the future, so a meeting logged right
 * after it happened can be rated and gets its debrief straight away.
 */
export function defaultMeetingMoment(now: Date): { date: IsoDate; time: string } {
  const [hour = "00", minute = "00"] = etTimeOf(now).split(":")
  const floored = Math.floor(Number(minute) / 15) * 15
  return { date: toEtDate(now), time: `${hour}:${String(floored).padStart(2, "0")}` }
}

/** True when the ET day and "HH:MM" given are after `now` (false while either is incomplete). */
export function isFutureMeeting(date: string, time: string, now: Date): boolean {
  if (!isIsoDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.slice(0, 5))) return false
  return etMoment(date, time.slice(0, 5)).getTime() > now.getTime()
}

type HasStart = { startsAt: string }

/**
 * The meeting log's two groups: scheduled ones (soonest first, so the next
 * meeting is on top) and the ones that have happened (newest first).
 */
export function splitMeetings<M extends HasStart>(
  meetings: readonly M[],
  now: Date,
): { scheduled: M[]; past: M[] } {
  const at = (m: M) => new Date(m.startsAt).getTime()
  const scheduled = meetings.filter((m) => at(m) > now.getTime()).sort((a, b) => at(a) - at(b))
  const past = meetings.filter((m) => at(m) <= now.getTime()).sort((a, b) => at(b) - at(a))
  return { scheduled, past }
}

/**
 * The people to offer as "who went from our side": every active teammate in
 * team order, plus anyone already on the meeting who has since left the team
 * (so an edit doesn't silently drop them).
 */
export function attendeeChoices<P extends { id: string }>(
  active: readonly P[],
  current: readonly P[],
): P[] {
  const ids = new Set(active.map((p) => p.id))
  return [...active, ...current.filter((p) => !ids.has(p.id))]
}

// ---------------------------------------------------------------------------
// The one-click follow-up task
// ---------------------------------------------------------------------------

/** Follow-up tasks are recognised by this title start (plus their link to the meeting). */
export const FOLLOW_UP_TITLE_PREFIX = "Follow up with "

/** "Follow up with Acme Ventures", shortened to fit a task title. */
export function followUpTaskTitle(orgName: string): string {
  const title = `${FOLLOW_UP_TITLE_PREFIX}${orgName.trim()}`
  return title.length <= TASK_LIMITS.title ? title : `${title.slice(0, TASK_LIMITS.title - 1)}…`
}

export type FollowUpSource = {
  org: {
    id: string
    name: string
    ownerId: string
    nextStep: string
    nextStepDate: IsoDate
  }
  meeting: {
    id: string
    startsAt: string
    followUpOwnerId: string | null
    followUpDate: IsoDate | null
    materialsRequested: string | null
    concernsRaised: string | null
  }
}

/**
 * The task "Add follow-up task" creates: the org's next step as the next
 * action, owned by the meeting's follow-up owner (else the org's owner), due on
 * the follow-up date (else the next step's date), linked to the org and the
 * meeting. What they asked for and worried about goes in the notes.
 */
export function followUpTaskDraft({ org, meeting }: FollowUpSource) {
  const notes = [
    `From the meeting on ${formatDate(toEtDate(meeting.startsAt), "long")}.`,
    meeting.materialsRequested ? `Materials requested: ${meeting.materialsRequested}` : null,
    meeting.concernsRaised ? `Concerns raised: ${meeting.concernsRaised}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n\n")
  return {
    title: followUpTaskTitle(org.name),
    next_action: org.nextStep,
    owner_id: meeting.followUpOwnerId ?? org.ownerId,
    due_date: meeting.followUpDate ?? org.nextStepDate,
    notes: notes.slice(0, TASK_LIMITS.notes),
    organization_id: org.id,
    org_meeting_id: meeting.id,
  }
}
