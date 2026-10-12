import "server-only"
import { getActivePeople } from "@/lib/data/people"
import type { CrunchPeriod } from "@/lib/crunch"
import { addDays, etMoment, type IsoDate } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import {
  keyResultLabel,
  orgMeetingLabel,
  sessionLabel,
  teamMeetingLabel,
  type TaskFormOptions,
} from "./options"
import { oldestDoneDay, type ViewTask } from "./views"

/**
 * Reads for the Tasks section. Server-only; each runs as the signed-in person
 * (RLS applies) and throws on a database error so the page shows its retry
 * screen. Call them inside <Suspense>, after requireTeamMember().
 */

type Enums = Database["public"]["Enums"]
type OrgKind = Enums["org_kind"]
export type ActorKind = "person" | "bot" | "system"

export type TaskOwner = { id: string; name: string; avatarUrl: string | null }
export type TaskOrg = { id: string; name: string; kind: OrgKind }

/** One row in a task list. */
export type TaskListItem = ViewTask & {
  nextAction: string
  owner: TaskOwner
  organization: TaskOrg | null
}

const LIST_COLUMNS = `
  id, title, next_action, status, priority, due_date, owner_id, completed_at,
  owner:people!tasks_owner_id_fkey ( id, name, avatar_url ),
  organization:organizations!tasks_organization_id_fkey ( id, name, kind )
`

/**
 * Every non-archived task that is open, or was finished recently enough for a
 * view to show it. The team is small, so one query feeds all four views.
 */
export async function listTasks(today: IsoDate): Promise<TaskListItem[]> {
  const supabase = await createClient()
  const doneSince = etMoment(oldestDoneDay(today), "00:00").toISOString()
  const { data, error } = await supabase
    .from("tasks")
    .select(LIST_COLUMNS)
    .is("archived_at", null)
    .or(`status.neq.done,completed_at.gte."${doneSince}"`)
    .order("due_date")
  if (error) throw new Error(`Couldn't load tasks: ${error.message}`)

  return data.map((t) => ({
    id: t.id,
    title: t.title,
    nextAction: t.next_action,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    ownerId: t.owner_id,
    completedAt: t.completed_at,
    owner: { id: t.owner.id, name: t.owner.name, avatarUrl: t.owner.avatar_url },
    organization: t.organization,
  }))
}

/** Who made a change: a teammate, the Grok bot ("via Grok"), or a scheduled job ("Automatic"). */
export type TaskActor = { name: string | null; kind: ActorKind }

export type TaskDetail = TaskListItem & {
  notes: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: TaskActor
  updatedBy: TaskActor
  owner: TaskOwner & { role: string; isActive: boolean }
  links: {
    organization: (TaskOrg & { archived: boolean }) | null
    session: { id: string; label: string } | null
    keyResult: { id: string; label: string } | null
    teamMeeting: { id: string; meetingDate: IsoDate } | null
    orgMeeting: { id: string; startsAt: string; org: TaskOrg | null } | null
  }
}

const DETAIL_COLUMNS = `
  id, title, next_action, notes, status, priority, due_date, owner_id, completed_at,
  archived_at, created_at, updated_at,
  owner:people!tasks_owner_id_fkey ( id, name, avatar_url, role, is_active ),
  organization:organizations!tasks_organization_id_fkey ( id, name, kind, archived_at ),
  session:synthe6_sessions!tasks_synthe6_session_id_fkey (
    id, week_label, start_date, end_date, topic, activity_type
  ),
  key_result:key_results!tasks_key_result_id_fkey (
    id, title,
    objective:objectives!key_results_objective_id_fkey (
      quarter:quarters!objectives_quarter_id_fkey ( label )
    )
  ),
  team_meeting:team_meetings!tasks_team_meeting_id_fkey ( id, meeting_date ),
  org_meeting:org_meetings!tasks_org_meeting_id_fkey (
    id, starts_at,
    organization:organizations!org_meetings_organization_id_fkey ( id, name, kind )
  ),
  created_by_actor:actors!tasks_created_by_fkey ( display_name, kind ),
  updated_by_actor:actors!tasks_updated_by_fkey ( display_name, kind )
`

function actor(row: { display_name: string; kind: Enums["actor_kind"] } | null): TaskActor {
  // No actor = a scheduled job or a server-side seed.
  return row ? { name: row.display_name, kind: row.kind } : { name: null, kind: "system" }
}

/** One task with its links and who created / last changed it. Archived tasks too; null if unknown. */
export async function getTask(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient()
  const { data: t, error } = await supabase
    .from("tasks")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the task: ${error.message}`)
  if (!t) return null

  return {
    id: t.id,
    title: t.title,
    nextAction: t.next_action,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    dueDate: t.due_date,
    ownerId: t.owner_id,
    completedAt: t.completed_at,
    archivedAt: t.archived_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    createdBy: actor(t.created_by_actor),
    updatedBy: actor(t.updated_by_actor),
    owner: {
      id: t.owner.id,
      name: t.owner.name,
      avatarUrl: t.owner.avatar_url,
      role: t.owner.role,
      isActive: t.owner.is_active,
    },
    organization: t.organization
      ? { id: t.organization.id, name: t.organization.name, kind: t.organization.kind }
      : null,
    links: {
      organization: t.organization
        ? {
            id: t.organization.id,
            name: t.organization.name,
            kind: t.organization.kind,
            archived: t.organization.archived_at !== null,
          }
        : null,
      session: t.session ? { id: t.session.id, label: sessionLabel(t.session) } : null,
      keyResult: t.key_result
        ? {
            id: t.key_result.id,
            label: keyResultLabel(t.key_result.title, t.key_result.objective?.quarter?.label),
          }
        : null,
      teamMeeting: t.team_meeting
        ? { id: t.team_meeting.id, meetingDate: t.team_meeting.meeting_date }
        : null,
      orgMeeting: t.org_meeting
        ? {
            id: t.org_meeting.id,
            startsAt: t.org_meeting.starts_at,
            org: t.org_meeting.organization,
          }
        : null,
    },
  }
}

/** Every crunch period on the team (small table): list markers and form warnings. */
export async function getCrunchPeriods(): Promise<CrunchPeriod[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crunch_periods")
    .select("person_id, label, start_date, end_date")
    .order("start_date")
  if (error) throw new Error(`Couldn't load crunch periods: ${error.message}`)
  return data.map((p) => ({
    personId: p.person_id,
    label: p.label,
    startDate: p.start_date,
    endDate: p.end_date,
  }))
}

/** How far back and ahead the "Link to…" selects reach for sessions and meetings. */
const LINK_WINDOW = { pastDays: 30, futureDays: 60 } as const

/**
 * Choices for the task form: active teammates, crunch periods, open orgs,
 * Synthe6 sessions from the last 30 days on, key results, and Sunday and org
 * meetings from 30 days back to 60 days ahead.
 */
export async function getTaskFormOptions(today: IsoDate): Promise<TaskFormOptions> {
  const supabase = await createClient()
  const from = addDays(today, -LINK_WINDOW.pastDays)
  const to = addDays(today, LINK_WINDOW.futureDays)

  const [people, crunchPeriods, orgs, sessions, keyResults, teamMeetings, orgMeetings] =
    await Promise.all([
      getActivePeople(),
      getCrunchPeriods(),
      supabase.from("organizations").select("id, name, kind").is("archived_at", null).order("name"),
      supabase
        .from("synthe6_sessions")
        .select("id, week_label, start_date, end_date, topic, activity_type")
        .eq("is_break", false)
        .gte("end_date", from)
        .order("start_date"),
      supabase
        .from("key_results")
        .select(
          `id, title, position,
           objective:objectives!key_results_objective_id_fkey (
             archived_at, position,
             quarter:quarters!objectives_quarter_id_fkey ( label )
           )`,
        )
        .is("archived_at", null),
      supabase
        .from("team_meetings")
        .select("id, meeting_date")
        .gte("meeting_date", from)
        .lte("meeting_date", to)
        .order("meeting_date", { ascending: false }),
      supabase
        .from("org_meetings")
        .select(
          `id, starts_at,
           organization:organizations!org_meetings_organization_id_fkey ( name, archived_at )`,
        )
        .gte("starts_at", etMoment(from, "00:00").toISOString())
        .lt("starts_at", etMoment(addDays(to, 1), "00:00").toISOString())
        .order("starts_at", { ascending: false }),
    ])

  for (const result of [orgs, sessions, keyResults, teamMeetings, orgMeetings]) {
    if (result.error) throw new Error(`Couldn't load the task form: ${result.error.message}`)
  }

  return {
    people: people.map((p) => ({ id: p.id, name: p.name })),
    crunchPeriods,
    organizations: (orgs.data ?? []).map((o) => ({ value: o.id, label: o.name, kind: o.kind })),
    sessions: (sessions.data ?? []).map((s) => ({ value: s.id, label: sessionLabel(s) })),
    keyResults: (keyResults.data ?? [])
      .filter((kr) => kr.objective && kr.objective.archived_at === null)
      .sort(
        (a, b) =>
          (a.objective?.quarter?.label ?? "").localeCompare(b.objective?.quarter?.label ?? "") ||
          (a.objective?.position ?? 0) - (b.objective?.position ?? 0) ||
          a.position - b.position,
      )
      .map((kr) => ({
        value: kr.id,
        label: keyResultLabel(kr.title, kr.objective?.quarter?.label),
      })),
    teamMeetings: (teamMeetings.data ?? []).map((m) => ({
      value: m.id,
      label: teamMeetingLabel(m.meeting_date, today),
    })),
    orgMeetings: (orgMeetings.data ?? [])
      .filter((m) => m.organization && m.organization.archived_at === null)
      .map((m) => ({
        value: m.id,
        label: orgMeetingLabel(m.organization?.name ?? "", m.starts_at),
      })),
  }
}
