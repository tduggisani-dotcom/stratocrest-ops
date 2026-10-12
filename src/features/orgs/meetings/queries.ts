import "server-only"
import { cache } from "react"
import { getActivePeople } from "@/lib/data/people"
import type { IsoDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import type { OrgKind } from "../kind-config"
import { FOLLOW_UP_TITLE_PREFIX } from "./helpers"

/**
 * Reads for the meeting log, the meeting form and the meeting page.
 * Server-only; each runs as the signed-in person (RLS applies) and throws on a
 * database error so the section shows its retry screen. Call them inside
 * <Suspense>, after requireTeamMember().
 */

type Enums = Database["public"]["Enums"]

export type MeetingPerson = { id: string; name: string; avatarUrl: string | null }

type PersonRow = { id: string; name: string; avatar_url: string | null; sort_order?: number }

function person(row: PersonRow): MeetingPerson {
  return { id: row.id, name: row.name, avatarUrl: row.avatar_url }
}

/** Our side, in team order. */
function attendeesFrom(rows: { person: PersonRow & { sort_order: number } }[]): MeetingPerson[] {
  return [...rows]
    .sort((a, b) => a.person.sort_order - b.person.sort_order)
    .map((row) => person(row.person))
}

const PERSON = "id, name, avatar_url, sort_order"

// ---------------------------------------------------------------------------
// The org page's meeting log
// ---------------------------------------------------------------------------

export type MeetingLogEntry = {
  id: string
  startsAt: string
  attendees: MeetingPerson[]
  externalAttendees: string | null
  rating: number | null
  summary: string | null
  followUpOwner: MeetingPerson | null
  followUpDate: IsoDate | null
  /** Its follow-up task ("Follow up with …", not archived) is done. */
  followUpTaskDone: boolean
  debrief: { status: Enums["debrief_status"]; dueDate: IsoDate } | null
}

/** Every meeting of one org (any order; the log groups and sorts them). */
export async function getMeetingLog(orgId: string): Promise<MeetingLogEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("org_meetings")
    .select(
      `id, starts_at, external_attendees, rating, summary, follow_up_date,
       follow_up_owner:people!org_meetings_follow_up_owner_id_fkey ( ${PERSON} ),
       attendees:org_meeting_attendees!org_meeting_attendees_org_meeting_id_fkey (
         person:people!org_meeting_attendees_person_id_fkey ( ${PERSON} )
       ),
       debrief:debriefs!debriefs_org_meeting_id_fkey ( status, due_date ),
       tasks:tasks!tasks_org_meeting_id_fkey ( title, status, archived_at )`,
    )
    .eq("organization_id", orgId)
    .order("starts_at", { ascending: false })
  if (error) throw new Error(`Couldn't load the meetings: ${error.message}`)
  return data.map((m) => ({
    id: m.id,
    startsAt: m.starts_at,
    attendees: attendeesFrom(m.attendees),
    externalAttendees: m.external_attendees,
    rating: m.rating,
    summary: m.summary,
    followUpOwner: m.follow_up_owner ? person(m.follow_up_owner) : null,
    followUpDate: m.follow_up_date,
    followUpTaskDone: m.tasks.some(
      (t) =>
        t.archived_at === null && t.status === "done" && t.title.startsWith(FOLLOW_UP_TITLE_PREFIX),
    ),
    debrief: m.debrief ? { status: m.debrief.status, dueDate: m.debrief.due_date } : null,
  }))
}

// ---------------------------------------------------------------------------
// The org a meeting belongs to
// ---------------------------------------------------------------------------

export type MeetingOrg = {
  id: string
  kind: OrgKind
  name: string
  owner: MeetingPerson
  nextStep: string
  nextStepDate: IsoDate
  archivedAt: string | null
}

const ORG_COLUMNS = `id, kind, name, next_step, next_step_date, archived_at,
  owner:people!organizations_owner_id_fkey ( ${PERSON} )`

type OrgRow = {
  id: string
  kind: OrgKind
  name: string
  next_step: string
  next_step_date: string
  archived_at: string | null
  owner: PersonRow
}

function orgFrom(row: OrgRow): MeetingOrg {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    owner: person(row.owner),
    nextStep: row.next_step,
    nextStepDate: row.next_step_date,
    archivedAt: row.archived_at,
  }
}

/** The org for the new-meeting form, or null (unknown id, or one of the other kind). */
export const getMeetingOrg = cache(async (kind: OrgKind, orgId: string) => {
  if (!isRecordId(orgId)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select(ORG_COLUMNS)
    .eq("id", orgId)
    .eq("kind", kind)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the record: ${error.message}`)
  return data ? orgFrom(data) : null
})

// ---------------------------------------------------------------------------
// One meeting
// ---------------------------------------------------------------------------

export type MeetingDetail = {
  id: string
  startsAt: string
  attendees: MeetingPerson[]
  externalAttendees: string | null
  rating: number | null
  summary: string | null
  notes: string | null
  concernsRaised: string | null
  materialsRequested: string | null
  followUpOwner: MeetingPerson | null
  followUpDate: IsoDate | null
  org: MeetingOrg
}

/**
 * One meeting with its org, or null when the ids are malformed or unknown, or
 * the meeting belongs to another org or kind (the page's 404). Cached per
 * request: the page's sections each read it.
 */
export const getMeeting = cache(
  async (kind: OrgKind, orgId: string, meetingId: string): Promise<MeetingDetail | null> => {
    if (!isRecordId(orgId) || !isRecordId(meetingId)) return null
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("org_meetings")
      .select(
        `id, starts_at, external_attendees, rating, summary, notes, concerns_raised,
         materials_requested, follow_up_date,
         follow_up_owner:people!org_meetings_follow_up_owner_id_fkey ( ${PERSON} ),
         attendees:org_meeting_attendees!org_meeting_attendees_org_meeting_id_fkey (
           person:people!org_meeting_attendees_person_id_fkey ( ${PERSON} )
         ),
         organization:organizations!org_meetings_organization_id_fkey ( ${ORG_COLUMNS} )`,
      )
      .eq("id", meetingId)
      .eq("organization_id", orgId)
      .maybeSingle()
    if (error) throw new Error(`Couldn't load the meeting: ${error.message}`)
    if (!data || data.organization.kind !== kind) return null
    return {
      id: data.id,
      startsAt: data.starts_at,
      attendees: attendeesFrom(data.attendees),
      externalAttendees: data.external_attendees,
      rating: data.rating,
      summary: data.summary,
      notes: data.notes,
      concernsRaised: data.concerns_raised,
      materialsRequested: data.materials_requested,
      followUpOwner: data.follow_up_owner ? person(data.follow_up_owner) : null,
      followUpDate: data.follow_up_date,
      org: orgFrom(data.organization),
    }
  },
)

/**
 * True when the org has had another meeting since this one (one that has
 * happened by `now`): its follow-up then no longer counts as overdue.
 */
export async function metSince(orgId: string, startsAt: string, now: Date): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("org_meetings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gt("starts_at", startsAt)
    .lte("starts_at", now.toISOString())
  if (error) throw new Error(`Couldn't load the meetings: ${error.message}`)
  return (count ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Tasks from a meeting
// ---------------------------------------------------------------------------

export type MeetingTask = {
  id: string
  title: string
  nextAction: string
  status: Enums["task_status"]
  dueDate: IsoDate
  owner: MeetingPerson
}

/** Tasks linked to the meeting (not archived): open ones first by due date, then done ones. */
export const getMeetingTasks = cache(async (meetingId: string): Promise<MeetingTask[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `id, title, next_action, status, due_date,
       owner:people!tasks_owner_id_fkey ( ${PERSON} )`,
    )
    .eq("org_meeting_id", meetingId)
    .is("archived_at", null)
    .order("due_date")
    .order("title")
  if (error) throw new Error(`Couldn't load the tasks: ${error.message}`)
  const tasks = data.map((t) => ({
    id: t.id,
    title: t.title,
    nextAction: t.next_action,
    status: t.status,
    dueDate: t.due_date,
    owner: person(t.owner),
  }))
  return [...tasks.filter((t) => t.status !== "done"), ...tasks.filter((t) => t.status === "done")]
})

/** The meeting's follow-up task ("Follow up with …", not archived; an open one first), or null. */
export function followUpTaskOf(tasks: readonly MeetingTask[]): MeetingTask | null {
  return tasks.find((t) => t.title.startsWith(FOLLOW_UP_TITLE_PREFIX)) ?? null
}

/** Active teammates for the attendee chips and the follow-up and facilitator pickers. */
export async function getMeetingPeople(): Promise<MeetingPerson[]> {
  const people = await getActivePeople()
  return people.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl }))
}
