import "server-only"
import { cache } from "react"
import type { CurrentPerson } from "@/lib/auth"
import { getActivePeople } from "@/lib/data/people"
import { todayEt, type IsoDate } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { Database, Tables } from "@/types/database"
import {
  LIMITS,
  compareTasksByDue,
  debriefSubject,
  pickQuarter,
  splitByPosted,
  weekEnd,
} from "./logic"

/**
 * Reads for the This Week page (spec §6.1), one function per section. Each
 * runs as the signed-in person (RLS applies), runs its independent queries in
 * parallel, keeps row counts small, and throws on a database error so only that
 * section shows its retry card. Call them inside <Suspense>, after
 * requireTeamMember().
 */

type Enums = Database["public"]["Enums"]
type OrgKind = Enums["org_kind"]

/** Who and when a section is read for. */
export type ThisWeekScope = { me: CurrentPerson; today: IsoDate; now: Date }

/**
 * One clock per request, so every section agrees on "today" and "now". Call it
 * after requireTeamMember() (which waits for the request), never while prerendering.
 */
export const requestClock = cache((): { now: Date; today: IsoDate } => {
  const now = new Date()
  return { now, today: todayEt(now) }
})

/** A list that shows the first few items, and how many there are in all. */
export type Counted<T> = { items: T[]; total: number }

export type Person = { id: string; name: string; avatarUrl: string | null }
export type TeamPerson = Person & { sortOrder: number }

type PersonRow = { id: string; name: string; avatar_url: string | null }
type TeamPersonRow = PersonRow & { sort_order: number }

function person(row: PersonRow): Person {
  return { id: row.id, name: row.name, avatarUrl: row.avatar_url }
}

function teamPerson(row: TeamPersonRow): TeamPerson {
  return { ...person(row), sortOrder: row.sort_order }
}

function counted<T>(items: T[], count: number | null): Counted<T> {
  return { items, total: Math.max(count ?? items.length, items.length) }
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Shared shapes: tasks, follow-ups, debriefs
// ---------------------------------------------------------------------------

export type WeekTask = {
  id: string
  title: string
  nextAction: string
  status: Enums["task_status"]
  priority: Enums["task_priority"]
  dueDate: IsoDate
  owner: Person
}

const TASK_COLUMNS = `
  id, title, next_action, status, priority, due_date,
  owner:people!tasks_owner_id_fkey ( id, name, avatar_url )
`

type TaskRow = {
  id: string
  title: string
  next_action: string
  status: Enums["task_status"]
  priority: Enums["task_priority"]
  due_date: string
  owner: PersonRow
}

function weekTask(row: TaskRow): WeekTask {
  return {
    id: row.id,
    title: row.title,
    nextAction: row.next_action,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    owner: person(row.owner),
  }
}

/** An investor or customer's next step (its "follow-up"; the owner is the org owner). */
export type FollowUp = {
  id: string
  kind: OrgKind
  name: string
  nextStep: string
  nextStepDate: IsoDate
  owner: Person
}

/** An org with no contact in 14+ days (org_overview.is_stale). */
export type StaleOrg = {
  id: string
  kind: OrgKind
  name: string
  daysSinceContact: number
  lastContactDate: IsoDate | null
  owner: Person
}

const ORG_COLUMNS = `
  id, kind, name, next_step, next_step_date, days_since_contact, last_contact_date,
  owner_id, owner_name, owner_avatar_url
`

type OrgOverviewRow = Pick<
  Tables<"org_overview">,
  | "id"
  | "kind"
  | "name"
  | "next_step"
  | "next_step_date"
  | "days_since_contact"
  | "last_contact_date"
  | "owner_id"
  | "owner_name"
  | "owner_avatar_url"
>

/** View columns are typed nullable; the underlying table columns aren't. Skip anything odd. */
function followUp(row: OrgOverviewRow): FollowUp | null {
  if (!row.id || !row.kind || !row.name || !row.next_step || !row.next_step_date) return null
  if (!row.owner_id || !row.owner_name) return null
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    nextStep: row.next_step,
    nextStepDate: row.next_step_date,
    owner: { id: row.owner_id, name: row.owner_name, avatarUrl: row.owner_avatar_url },
  }
}

function staleOrg(row: OrgOverviewRow): StaleOrg | null {
  if (!row.id || !row.kind || !row.name || row.days_since_contact === null) return null
  if (!row.owner_id || !row.owner_name) return null
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    daysSinceContact: row.days_since_contact,
    lastContactDate: row.last_contact_date,
    owner: { id: row.owner_id, name: row.owner_name, avatarUrl: row.owner_avatar_url },
  }
}

function present<T>(value: T | null): value is T {
  return value !== null
}

export type DueDebrief = {
  id: string
  kind: Enums["debrief_kind"]
  dueDate: IsoDate
  /** What it's about: "W2 · Goal Setting", "Acme Ventures, Oct 4", "Sunday meeting, Oct 11". */
  subject: string
  facilitator: Person | null
}

const DEBRIEF_COLUMNS = `
  id, kind, due_date,
  facilitator:people!debriefs_facilitator_id_fkey ( id, name, avatar_url ),
  session:synthe6_sessions!debriefs_synthe6_session_id_fkey ( week_label, topic, activity_type ),
  org_meeting:org_meetings!debriefs_org_meeting_id_fkey (
    starts_at,
    organization:organizations!org_meetings_organization_id_fkey ( name )
  ),
  team_meeting:team_meetings!debriefs_team_meeting_id_fkey ( meeting_date )
`

type DebriefRow = {
  id: string
  kind: Enums["debrief_kind"]
  due_date: string
  facilitator: PersonRow | null
  session: { week_label: string | null; topic: string | null; activity_type: string } | null
  org_meeting: { starts_at: string; organization: { name: string } | null } | null
  team_meeting: { meeting_date: string } | null
}

function dueDebrief(row: DebriefRow): DueDebrief {
  return {
    id: row.id,
    kind: row.kind,
    dueDate: row.due_date,
    facilitator: row.facilitator ? person(row.facilitator) : null,
    subject: debriefSubject({
      kind: row.kind,
      session: row.session
        ? {
            weekLabel: row.session.week_label,
            topic: row.session.topic,
            activityType: row.session.activity_type,
          }
        : null,
      orgMeeting: row.org_meeting
        ? {
            startsAt: row.org_meeting.starts_at,
            orgName: row.org_meeting.organization?.name ?? null,
          }
        : null,
      teamMeeting: row.team_meeting ? { meetingDate: row.team_meeting.meeting_date } : null,
    }),
  }
}

// ---------------------------------------------------------------------------
// 1. My work
// ---------------------------------------------------------------------------

export type MyWork = {
  /** The last day "this week" covers (this Sunday). */
  weekEnd: IsoDate
  tasks: Counted<WeekTask>
  followUps: Counted<FollowUp>
  debriefs: Counted<DueDebrief>
}

/**
 * The signed-in person's open tasks (soonest due first, so overdue on top),
 * their investors' and customers' next steps due by Sunday, and the debriefs
 * they facilitate that are due.
 */
export async function getMyWork({ me, today }: ThisWeekScope): Promise<MyWork> {
  const supabase = await createClient()
  const end = weekEnd(today)

  const [tasks, followUps, debriefs] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS, { count: "exact" })
      .eq("owner_id", me.id)
      .neq("status", "done")
      .is("archived_at", null)
      .order("due_date")
      .order("priority", { ascending: false })
      .order("title")
      .limit(LIMITS.myTasks),
    supabase
      .from("org_overview")
      .select(ORG_COLUMNS, { count: "exact" })
      .eq("owner_id", me.id)
      .eq("stage_outcome", "open")
      .is("archived_at", null)
      .lte("next_step_date", end)
      .order("next_step_date")
      .order("name")
      .limit(LIMITS.myOther),
    supabase
      .from("debriefs")
      .select(DEBRIEF_COLUMNS, { count: "exact" })
      .eq("facilitator_id", me.id)
      .eq("status", "due")
      .lte("due_date", today)
      .order("due_date")
      .limit(LIMITS.myOther),
  ])
  if (tasks.error) fail("your tasks", tasks.error)
  if (followUps.error) fail("your follow-ups", followUps.error)
  if (debriefs.error) fail("your debriefs", debriefs.error)

  return {
    weekEnd: end,
    tasks: counted(tasks.data.map(weekTask).sort(compareTasksByDue), tasks.count),
    followUps: counted(followUps.data.map(followUp).filter(present), followUps.count),
    debriefs: counted(debriefs.data.map(dueDebrief), debriefs.count),
  }
}

// ---------------------------------------------------------------------------
// 2. Needs attention (team-wide)
// ---------------------------------------------------------------------------

export type HelpRequest = {
  id: string
  message: string
  createdAt: string
  requester: Person
}

export type NeedsAttention = {
  overdueTasks: Counted<WeekTask>
  overdueFollowUps: Counted<FollowUp>
  staleOrgs: Counted<StaleOrg>
  debriefsDue: Counted<DueDebrief>
  helpRequests: Counted<HelpRequest>
}

/**
 * Everyone's overdue tasks and follow-ups, investors and customers with no
 * contact in 14+ days (longest silence first), debriefs due, and open help
 * requests (longest waiting first).
 */
export async function getNeedsAttention({ today }: ThisWeekScope): Promise<NeedsAttention> {
  const supabase = await createClient()
  const limit = LIMITS.attention

  const [tasks, followUps, stale, debriefs, help] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS, { count: "exact" })
      .neq("status", "done")
      .is("archived_at", null)
      .lt("due_date", today)
      .order("due_date")
      .order("priority", { ascending: false })
      .order("title")
      .limit(limit),
    supabase
      .from("org_overview")
      .select(ORG_COLUMNS, { count: "exact" })
      .eq("follow_up_overdue", true)
      .is("archived_at", null)
      .order("next_step_date")
      .order("name")
      .limit(limit),
    supabase
      .from("org_overview")
      .select(ORG_COLUMNS, { count: "exact" })
      .eq("is_stale", true)
      .is("archived_at", null)
      .order("days_since_contact", { ascending: false })
      .order("name")
      .limit(limit),
    supabase
      .from("debriefs")
      .select(DEBRIEF_COLUMNS, { count: "exact" })
      .eq("status", "due")
      .lte("due_date", today)
      .order("due_date")
      .limit(limit),
    supabase
      .from("help_requests")
      .select(
        `id, message, created_at,
         requester:people!help_requests_requester_id_fkey ( id, name, avatar_url )`,
        { count: "exact" },
      )
      .is("resolved_at", null)
      .order("created_at")
      .limit(limit),
  ])
  if (tasks.error) fail("overdue tasks", tasks.error)
  if (followUps.error) fail("overdue follow-ups", followUps.error)
  if (stale.error) fail("quiet investors and customers", stale.error)
  if (debriefs.error) fail("debriefs due", debriefs.error)
  if (help.error) fail("help requests", help.error)

  return {
    overdueTasks: counted(tasks.data.map(weekTask).sort(compareTasksByDue), tasks.count),
    overdueFollowUps: counted(followUps.data.map(followUp).filter(present), followUps.count),
    staleOrgs: counted(stale.data.map(staleOrg).filter(present), stale.count),
    debriefsDue: counted(debriefs.data.map(dueDebrief), debriefs.count),
    helpRequests: counted(
      help.data.map((h) => ({
        id: h.id,
        message: h.message,
        createdAt: h.created_at,
        requester: person(h.requester),
      })),
      help.count,
    ),
  }
}

// ---------------------------------------------------------------------------
// 3. Next Synthe6 session
// ---------------------------------------------------------------------------

export type NextSession = {
  id: string
  weekLabel: string | null
  startDate: IsoDate
  endDate: IsoDate
  startTime: string | null
  endTime: string | null
  format: string
  activityType: string
  topic: string | null
  emphasis: Enums["session_emphasis"] | null
  owner: Person | null
}

/** The next session that isn't a break week and hasn't ended (a session on today counts). */
export async function getNextSession({ today }: ThisWeekScope): Promise<NextSession | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("synthe6_sessions")
    .select(
      `id, week_label, start_date, end_date, start_time, end_time, format, activity_type,
       topic, emphasis,
       owner:people!synthe6_sessions_owner_id_fkey ( id, name, avatar_url )`,
    )
    .eq("is_break", false)
    .gte("end_date", today)
    .order("start_date")
    .limit(1)
    .maybeSingle()
  if (error) fail("the next Synthe6 session", error)
  if (!data) return null

  return {
    id: data.id,
    weekLabel: data.week_label,
    startDate: data.start_date,
    endDate: data.end_date,
    startTime: data.start_time,
    endTime: data.end_time,
    format: data.format,
    activityType: data.activity_type,
    topic: data.topic,
    emphasis: data.emphasis,
    owner: data.owner ? person(data.owner) : null,
  }
}

// ---------------------------------------------------------------------------
// 4. Next Sunday meeting
// ---------------------------------------------------------------------------

export type NextSundayMeeting = {
  id: string
  meetingDate: IsoDate
  startsAt: string
  facilitator: Person
  /** Submitted a pre-meeting update, in team order. */
  posted: TeamPerson[]
  /** Active teammates without a submitted update, in team order. */
  notPosted: TeamPerson[]
}

/** The nearest upcoming Sunday meeting (today's counts), its facilitator, and who has posted. */
export async function getNextSundayMeeting({
  today,
}: ThisWeekScope): Promise<NextSundayMeeting | null> {
  const supabase = await createClient()
  const [meeting, people] = await Promise.all([
    supabase
      .from("team_meetings")
      .select(
        `id, meeting_date, starts_at,
         facilitator:people!team_meetings_facilitator_id_fkey ( id, name, avatar_url ),
         updates:meeting_updates!meeting_updates_team_meeting_id_fkey (
           submitted_at,
           person:people!meeting_updates_person_id_fkey ( id, name, avatar_url, sort_order )
         )`,
      )
      .eq("status", "upcoming")
      .gte("meeting_date", today)
      .order("meeting_date")
      .limit(1)
      .maybeSingle(),
    getActivePeople(),
  ])
  if (meeting.error) fail("the next Sunday meeting", meeting.error)
  if (!meeting.data) return null

  const m = meeting.data
  const { posted, notPosted } = splitByPosted(
    people.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, sortOrder: p.sortOrder })),
    m.updates.map((u) => ({ submittedAt: u.submitted_at, person: teamPerson(u.person) })),
  )
  return {
    id: m.id,
    meetingDate: m.meeting_date,
    startsAt: m.starts_at,
    facilitator: person(m.facilitator),
    posted,
    notPosted,
  }
}

// ---------------------------------------------------------------------------
// 5. Investor and customer meetings in the next 7 days
// ---------------------------------------------------------------------------

export type UpcomingOrgMeeting = {
  id: string
  startsAt: string
  org: { id: string; name: string; kind: OrgKind }
  owner: TeamPerson
  /** Our side, in team order (empty when nobody is listed yet). */
  attendees: TeamPerson[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Meetings with investors and customers (not archived) starting within the next 7 days. */
export async function getUpcomingOrgMeetings({
  now,
}: ThisWeekScope): Promise<Counted<UpcomingOrgMeeting>> {
  const supabase = await createClient()
  const { data, count, error } = await supabase
    .from("org_meetings")
    .select(
      `id, starts_at,
       organization:organizations!org_meetings_organization_id_fkey!inner (
         id, name, kind, archived_at,
         owner:people!organizations_owner_id_fkey ( id, name, avatar_url, sort_order )
       ),
       attendees:org_meeting_attendees!org_meeting_attendees_org_meeting_id_fkey (
         person:people!org_meeting_attendees_person_id_fkey ( id, name, avatar_url, sort_order )
       )`,
      { count: "exact" },
    )
    .is("organization.archived_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", new Date(now.getTime() + WEEK_MS).toISOString())
    .order("starts_at")
    .limit(LIMITS.orgMeetings)
  if (error) fail("upcoming meetings", error)

  return counted(
    data.map((m) => ({
      id: m.id,
      startsAt: m.starts_at,
      org: { id: m.organization.id, name: m.organization.name, kind: m.organization.kind },
      owner: teamPerson(m.organization.owner),
      attendees: m.attendees
        .map((a) => teamPerson(a.person))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    })),
    count,
  )
}

// ---------------------------------------------------------------------------
// 6. OKR progress
// ---------------------------------------------------------------------------

export type WeekKeyResult = {
  id: string
  title: string
  unit: string | null
  startValue: number
  targetValue: number
  currentValue: number
  owner: Person
}

export type WeekObjective = {
  id: string
  title: string
  owner: Person
  keyResults: WeekKeyResult[]
}

export type OkrProgress = {
  quarter: {
    id: string
    label: string
    startDate: IsoDate
    endDate: IsoDate
    shareOutDate: IsoDate
    /** "current" while today is inside it; "upcoming" before it starts. */
    status: "current" | "upcoming"
    /** The Synthe6 week of the share-out ("W10"), when linked. */
    shareOutWeekLabel: string | null
    /** The Synthe6 week that starts the quarter ("W2" for Q1, when goals are set), if any. */
    startWeekLabel: string | null
  }
  objectives: WeekObjective[]
}

/**
 * The current quarter (or the next one, before it starts) with its objectives
 * and key results, archived ones left out. Null after the last quarter.
 */
export async function getOkrProgress({ today }: ThisWeekScope): Promise<OkrProgress | null> {
  const supabase = await createClient()
  const { data: quarters, error } = await supabase
    .from("quarters")
    .select(
      `id, label, start_date, end_date, share_out_date,
       share_out_session:synthe6_sessions!quarters_share_out_session_id_fkey ( week_label )`,
    )
    .order("start_date")
  if (error) fail("quarters", error)

  const picked = pickQuarter(
    quarters.map((q) => ({ ...q, startDate: q.start_date, endDate: q.end_date })),
    today,
  )
  if (!picked) return null
  const q = picked.quarter

  const [objectives, startSession] = await Promise.all([
    supabase
      .from("objectives")
      .select(
        `id, title, position, created_at,
         owner:people!objectives_owner_id_fkey ( id, name, avatar_url ),
         key_results:key_results!key_results_objective_id_fkey (
           id, title, unit, start_value, target_value, current_value, position, archived_at,
           created_at,
           owner:people!key_results_owner_id_fkey ( id, name, avatar_url )
         )`,
      )
      .eq("quarter_id", q.id)
      .is("archived_at", null)
      .order("position")
      .order("created_at"),
    supabase
      .from("synthe6_sessions")
      .select("week_label")
      .eq("start_date", q.start_date)
      .eq("is_break", false)
      .maybeSingle(),
  ])
  if (objectives.error) fail("OKRs", objectives.error)
  if (startSession.error) fail("the quarter's first session", startSession.error)

  return {
    quarter: {
      id: q.id,
      label: q.label,
      startDate: q.start_date,
      endDate: q.end_date,
      shareOutDate: q.share_out_date,
      status: picked.status,
      shareOutWeekLabel: q.share_out_session?.week_label ?? null,
      startWeekLabel: startSession.data?.week_label ?? null,
    },
    objectives: objectives.data.map((o) => ({
      id: o.id,
      title: o.title,
      owner: person(o.owner),
      keyResults: o.key_results
        .filter((kr) => kr.archived_at === null)
        .sort(
          (a, b) =>
            a.position - b.position ||
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        )
        .map((kr) => ({
          id: kr.id,
          title: kr.title,
          unit: kr.unit,
          startValue: Number(kr.start_value),
          targetValue: Number(kr.target_value),
          currentValue: Number(kr.current_value),
          owner: person(kr.owner),
        })),
    })),
  }
}
