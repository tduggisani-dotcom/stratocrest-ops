import "server-only"
import { cache } from "react"
import { getActivePeople } from "@/lib/data/people"
import type { IsoDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import { otherOrgKind } from "@/lib/schemas/organizations"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"
import { activityActor, type ActivityContext, type ActivityEntry } from "../activity"
import type { OrgKind, OrgRegion, OrgSubtype } from "../kind-config"

/**
 * Reads for the org page and the org form. Server-only; each runs as the
 * signed-in person (RLS applies) and throws on a database error so the section
 * shows its retry screen. Call them inside <Suspense>, after requireTeamMember().
 * The page's sections stream separately, so the shared reads are cached per request.
 */

type Enums = Database["public"]["Enums"]
type Row = Record<string, unknown>

export type OrgPerson = { id: string; name: string; avatarUrl: string | null }

export type OrgDetail = {
  id: string
  kind: OrgKind
  name: string
  stage: string
  stageLabel: string
  stageOutcome: "open" | "won" | "lost"
  subtype: OrgSubtype | null
  owner: OrgPerson & { role: string; isActive: boolean }
  nextStep: string
  nextStepDate: IsoDate
  contactName: string | null
  contactTitle: string | null
  contactEmail: string | null
  contactPhone: string | null
  link: string | null
  city: string | null
  stateOrCountry: string | null
  region: OrgRegion | null
  firstContactDate: IsoDate | null
  firstContactMethod: Enums["contact_method"] | null
  introducedBy: string | null
  checkSizeOrFocus: string | null
  /** Derived: the later of the latest meeting that happened and the hand-entered date. */
  lastContactDate: IsoDate | null
  /** Contact outside meetings, entered by hand. */
  manualLastContactDate: IsoDate | null
  daysSinceContact: number
  isStale: boolean
  followUpOverdue: boolean
  latestMeetingAt: string | null
  nextMeetingAt: string | null
  notes: string | null
  keyResult: {
    id: string
    title: string
    objectiveTitle: string | null
    quarterLabel: string | null
    archived: boolean
  } | null
  related: { id: string; name: string; kind: OrgKind; archived: boolean } | null
  archivedAt: string | null
  createdAt: string
}

const OUTCOMES = ["open", "won", "lost"] as const

/**
 * One investor or customer with everything its page header and details show.
 * Null when the id is malformed, unknown, or belongs to the other kind (a 404).
 * Archived orgs too.
 */
export const getOrg = cache(async (kind: OrgKind, id: string): Promise<OrgDetail | null> => {
  if (!isRecordId(id)) return null
  const supabase = await createClient()
  const [overview, extra] = await Promise.all([
    supabase.from("org_overview").select("*").eq("id", id).eq("kind", kind).maybeSingle(),
    supabase
      .from("organizations")
      .select(
        `notes,
         owner:people!organizations_owner_id_fkey ( id, name, avatar_url, role, is_active ),
         key_result:key_results!organizations_key_result_id_fkey (
           id, title, archived_at,
           objective:objectives!key_results_objective_id_fkey (
             title, archived_at,
             quarter:quarters!objectives_quarter_id_fkey ( label )
           )
         )`,
      )
      .eq("id", id)
      .eq("kind", kind)
      .maybeSingle(),
  ])
  if (overview.error) throw new Error(`Couldn't load the record: ${overview.error.message}`)
  if (extra.error) throw new Error(`Couldn't load the record: ${extra.error.message}`)
  const o = overview.data
  const e = extra.data
  if (!o || !e || !o.id || !o.name || !o.stage || !o.next_step || !o.next_step_date) return null

  let related: OrgDetail["related"] = null
  if (o.related_organization_id) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, kind, archived_at")
      .eq("id", o.related_organization_id)
      .maybeSingle()
    if (error) throw new Error(`Couldn't load the related record: ${error.message}`)
    related = data
      ? { id: data.id, name: data.name, kind: data.kind, archived: data.archived_at !== null }
      : null
  }

  const kr = e.key_result
  return {
    id: o.id,
    kind,
    name: o.name,
    stage: o.stage,
    stageLabel: o.stage_label ?? o.stage,
    stageOutcome: OUTCOMES.find((x) => x === o.stage_outcome) ?? "open",
    subtype: o.subtype,
    owner: {
      id: e.owner.id,
      name: e.owner.name,
      avatarUrl: e.owner.avatar_url,
      role: e.owner.role,
      isActive: e.owner.is_active,
    },
    nextStep: o.next_step,
    nextStepDate: o.next_step_date,
    contactName: o.contact_name,
    contactTitle: o.contact_title,
    contactEmail: o.contact_email,
    contactPhone: o.contact_phone,
    link: o.link,
    city: o.city,
    stateOrCountry: o.state_or_country,
    region: o.region,
    firstContactDate: o.first_contact_date,
    firstContactMethod: o.first_contact_method,
    introducedBy: o.introduced_by,
    checkSizeOrFocus: o.check_size_or_focus,
    lastContactDate: o.last_contact_date,
    manualLastContactDate: o.manual_last_contact_date,
    daysSinceContact: o.days_since_contact ?? 0,
    isStale: o.is_stale === true,
    followUpOverdue: o.follow_up_overdue === true,
    latestMeetingAt: o.latest_meeting_at,
    nextMeetingAt: o.next_meeting_at,
    notes: e.notes,
    keyResult: kr
      ? {
          id: kr.id,
          title: kr.title,
          objectiveTitle: kr.objective?.title ?? null,
          quarterLabel: kr.objective?.quarter?.label ?? null,
          archived: kr.archived_at !== null || (kr.objective?.archived_at ?? null) !== null,
        }
      : null,
    related,
    archivedAt: o.archived_at,
    createdAt: o.created_at ?? "",
  }
})

export type OrgMeetingRef = { id: string; startsAt: string }

/** The org's meetings (id and start), newest first: for tasks, debriefs and the history. */
export const getOrgMeetingRefs = cache(async (orgId: string): Promise<OrgMeetingRef[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("org_meetings")
    .select("id, starts_at")
    .eq("organization_id", orgId)
    .order("starts_at", { ascending: false })
  if (error) throw new Error(`Couldn't load the meetings: ${error.message}`)
  return data.map((m) => ({ id: m.id, startsAt: m.starts_at }))
})

export type OrgTask = {
  id: string
  title: string
  nextAction: string
  status: Enums["task_status"]
  dueDate: IsoDate
  completedAt: string | null
  owner: OrgPerson
}

/** How many recently finished tasks the org page lists under the open ones. */
export const RECENT_DONE_TASKS = 5

const TASK_COLUMNS = `id, title, next_action, status, due_date, completed_at,
  owner:people!tasks_owner_id_fkey ( id, name, avatar_url )`

/**
 * Tasks linked to the org, or to one of its meetings: every open one (soonest
 * due first) and the latest few done ones. Archived tasks are left out.
 */
export async function getOrgTasks(
  orgId: string,
): Promise<{ open: OrgTask[]; done: OrgTask[]; doneTotal: number }> {
  const meetings = await getOrgMeetingRefs(orgId)
  const supabase = await createClient()
  const linked =
    meetings.length > 0
      ? `organization_id.eq.${orgId},org_meeting_id.in.(${meetings.map((m) => m.id).join(",")})`
      : `organization_id.eq.${orgId}`
  const [open, done] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .is("archived_at", null)
      .or(linked)
      .neq("status", "done")
      .order("due_date")
      .order("title"),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS, { count: "exact" })
      .is("archived_at", null)
      .or(linked)
      .eq("status", "done")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(RECENT_DONE_TASKS),
  ])
  if (open.error) throw new Error(`Couldn't load the tasks: ${open.error.message}`)
  if (done.error) throw new Error(`Couldn't load the tasks: ${done.error.message}`)
  const toTask = (t: (typeof open.data)[number]): OrgTask => ({
    id: t.id,
    title: t.title,
    nextAction: t.next_action,
    status: t.status,
    dueDate: t.due_date,
    completedAt: t.completed_at,
    owner: { id: t.owner.id, name: t.owner.name, avatarUrl: t.owner.avatar_url },
  })
  return {
    open: open.data.map(toTask),
    done: done.data.map(toTask),
    doneTotal: done.count ?? done.data.length,
  }
}

export type OrgDebrief = {
  id: string
  meetingId: string
  meetingAt: string
  status: Enums["debrief_status"]
  dueDate: IsoDate
  completedAt: string | null
  facilitator: OrgPerson | null
}

/** Debriefs of the org's meetings: open ones first (soonest due), then done ones (newest meeting first). */
export async function getOrgDebriefs(orgId: string): Promise<OrgDebrief[]> {
  const meetings = await getOrgMeetingRefs(orgId)
  if (meetings.length === 0) return []
  const startsAt = new Map(meetings.map((m) => [m.id, m.startsAt]))
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debriefs")
    .select(
      `id, status, due_date, completed_at, org_meeting_id,
       facilitator:people!debriefs_facilitator_id_fkey ( id, name, avatar_url )`,
    )
    .in(
      "org_meeting_id",
      meetings.map((m) => m.id),
    )
  if (error) throw new Error(`Couldn't load the debriefs: ${error.message}`)
  return data
    .flatMap((d): OrgDebrief[] => {
      const meetingAt = d.org_meeting_id ? startsAt.get(d.org_meeting_id) : undefined
      if (!d.org_meeting_id || !meetingAt) return []
      return [
        {
          id: d.id,
          meetingId: d.org_meeting_id,
          meetingAt,
          status: d.status,
          dueDate: d.due_date,
          completedAt: d.completed_at,
          facilitator: d.facilitator
            ? {
                id: d.facilitator.id,
                name: d.facilitator.name,
                avatarUrl: d.facilitator.avatar_url,
              }
            : null,
        },
      ]
    })
    .sort((a, b) =>
      a.status !== b.status
        ? a.status === "due"
          ? -1
          : 1
        : a.status === "due"
          ? a.dueDate.localeCompare(b.dueDate)
          : b.meetingAt.localeCompare(a.meetingAt),
    )
}

/** How many entries the history shows before "Show more", and the most it loads. */
export const HISTORY_PREVIEW = 20
export const HISTORY_LIMIT = 100

const ACTIVITY_COLUMNS = `id, occurred_at, action, entity_type, entity_id, before, after,
  changed_fields, actor_kind,
  actor:actors!activity_log_actor_id_fkey (
    id, kind, display_name,
    person:people!people_id_fkey ( name, avatar_url )
  )`

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null
}

/**
 * The org's history, newest first: changes to the org, its meetings and who
 * went, its hypotheses and their evidence, and the meetings' debriefs. Also
 * returns what the sentences need (people, meeting dates, hypothesis statements).
 */
export async function getOrgActivity(
  kind: OrgKind,
  orgId: string,
): Promise<{ entries: ActivityEntry[]; context: ActivityContext }> {
  const supabase = await createClient()
  const [meetings, hypotheses, people] = await Promise.all([
    getOrgMeetingRefs(orgId),
    supabase.from("hypotheses").select("id, statement").eq("organization_id", orgId),
    supabase.from("people").select("id, name"),
  ])
  if (hypotheses.error) throw new Error(`Couldn't load the history: ${hypotheses.error.message}`)
  if (people.error) throw new Error(`Couldn't load the history: ${people.error.message}`)

  // Ids come from the database (uuids), so they are safe inside the filter.
  const meetingIds = meetings.map((m) => m.id).join(",")
  const hypothesisIds = hypotheses.data.map((h) => h.id).join(",")
  const filters = [
    `and(entity_type.eq.organizations,entity_id.eq.${orgId})`,
    // Meetings and hypotheses by their org, so removed ones and ones moved away still show.
    `and(entity_type.in.(org_meetings,hypotheses),or(after->>organization_id.eq.${orgId},before->>organization_id.eq.${orgId}))`,
  ]
  if (meetingIds) {
    filters.push(
      `and(entity_type.in.(org_meeting_attendees,debriefs),or(after->>org_meeting_id.in.(${meetingIds}),before->>org_meeting_id.in.(${meetingIds})))`,
    )
  }
  if (hypothesisIds) {
    filters.push(
      `and(entity_type.eq.hypothesis_tests,or(after->>hypothesis_id.in.(${hypothesisIds}),before->>hypothesis_id.in.(${hypothesisIds})))`,
    )
  }

  const { data, error } = await supabase
    .from("activity_log")
    .select(ACTIVITY_COLUMNS)
    .or(filters.join(","))
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw new Error(`Couldn't load the history: ${error.message}`)

  return {
    entries: data.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: asRow(row.before),
      after: asRow(row.after),
      changedFields: row.changed_fields,
      actor: activityActor(row.actor_kind, row.actor),
    })),
    context: {
      kind,
      people: new Map(people.data.map((p) => [p.id, p.name])),
      meetings: new Map(meetings.map((m) => [m.id, m.startsAt])),
      hypotheses: new Map(hypotheses.data.map((h) => [h.id, h.statement])),
    },
  }
}

export type OrgOption = { value: string; label: string }
export type KeyResultGroup = { label: string; options: OrgOption[] }

export type OrgFormOptions = {
  people: { id: string; name: string }[]
  /** Non-archived key results, grouped by "Q1 · <objective>". */
  keyResults: KeyResultGroup[]
  /** Active orgs of the other kind (the same company tracked as both). */
  relatedOrgs: OrgOption[]
}

/** Choices for the add and edit forms. */
export async function getOrgFormOptions(kind: OrgKind): Promise<OrgFormOptions> {
  const supabase = await createClient()
  const [people, keyResults, relatedOrgs] = await Promise.all([
    getActivePeople(),
    supabase
      .from("key_results")
      .select(
        `id, title, position,
         objective:objectives!key_results_objective_id_fkey (
           id, title, archived_at, position,
           quarter:quarters!objectives_quarter_id_fkey ( label, start_date )
         )`,
      )
      .is("archived_at", null),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("kind", otherOrgKind(kind))
      .is("archived_at", null)
      .order("name"),
  ])
  if (keyResults.error) throw new Error(`Couldn't load the form: ${keyResults.error.message}`)
  if (relatedOrgs.error) throw new Error(`Couldn't load the form: ${relatedOrgs.error.message}`)

  const groups = new Map<string, { label: string; sort: string; options: OrgOption[] }>()
  const live = keyResults.data
    .filter((kr) => kr.objective && kr.objective.archived_at === null)
    .sort((a, b) => a.position - b.position)
  for (const kr of live) {
    const objective = kr.objective
    if (!objective) continue
    const quarter = objective.quarter
    const label = quarter ? `${quarter.label} · ${objective.title}` : objective.title
    const sort = `${quarter?.start_date ?? "9999"}|${String(objective.position).padStart(4, "0")}|${objective.id}`
    const group = groups.get(objective.id) ?? { label, sort, options: [] }
    group.options.push({ value: kr.id, label: kr.title })
    groups.set(objective.id, group)
  }

  return {
    people: people.map((p) => ({ id: p.id, name: p.name })),
    keyResults: [...groups.values()]
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .map(({ label, options }) => ({ label, options })),
    relatedOrgs: relatedOrgs.data.map((o) => ({ value: o.id, label: o.name })),
  }
}
