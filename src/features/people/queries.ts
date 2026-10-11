import "server-only"
import { cache } from "react"
import { orgStagesByKind, orgStageLabel } from "@/lib/labels"
import { todayEt, type IsoDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/types/database"
import {
  countBy,
  keyResultProgress,
  splitCrunchPeriods,
  toHourMinute,
  type AvailabilityBlock,
  type CrunchPeriodView,
} from "@/features/people/format"

/**
 * People data for /people and /people/[id]. Runs as the signed-in person (RLS),
 * so call it inside <Suspense> after requireTeamMember(). Errors throw, which
 * shows the page's retry screen.
 */

type OrgKind = Enums<"org_kind">

/** Open pipeline stages only: a committed or passed investor isn't on anyone's plate. */
function isOpenStage(kind: OrgKind, stage: string): boolean {
  return orgStagesByKind[kind].some((s) => s.value === stage && s.outcome === "open")
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Couldn't load ${what}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// /people
// ---------------------------------------------------------------------------

export type PersonCard = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  contactPreference: string | null
  strengths: string[]
  isActive: boolean
  openTasks: number
  investorsOwned: number
  customersOwned: number
  keyResultsOwned: number
}

export type PeopleList = {
  /** Active teammates in team order. */
  active: PersonCard[]
  /** Deactivated teammates, by name (their history and any items left to reassign). */
  former: PersonCard[]
}

/**
 * Everyone on the team with what they own: open tasks, investors and customers
 * in an open stage, and key results (none archived).
 */
export async function listPeople(): Promise<PeopleList> {
  const supabase = await createClient()
  const [people, tasks, orgs, keyResults] = await Promise.all([
    supabase
      .from("people")
      .select("id, name, role, avatar_url, contact_preference, strengths, is_active, sort_order")
      .order("sort_order")
      .order("name"),
    supabase.from("tasks").select("owner_id").is("archived_at", null).neq("status", "done"),
    supabase.from("organizations").select("owner_id, kind, stage").is("archived_at", null),
    supabase
      .from("key_results")
      .select("owner_id, objectives!inner(archived_at)")
      .is("archived_at", null)
      .is("objectives.archived_at", null),
  ])
  if (people.error) fail("the team", people.error)
  if (tasks.error) fail("open tasks", tasks.error)
  if (orgs.error) fail("investors and customers", orgs.error)
  if (keyResults.error) fail("key results", keyResults.error)

  const openOrgs = orgs.data.filter((o) => isOpenStage(o.kind, o.stage))
  const openTasks = countBy(tasks.data, (t) => t.owner_id)
  const investors = countBy(
    openOrgs.filter((o) => o.kind === "investor"),
    (o) => o.owner_id,
  )
  const customers = countBy(
    openOrgs.filter((o) => o.kind === "customer"),
    (o) => o.owner_id,
  )
  const krs = countBy(keyResults.data, (k) => k.owner_id)

  const cards: PersonCard[] = people.data.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    avatarUrl: p.avatar_url,
    contactPreference: p.contact_preference,
    strengths: p.strengths,
    isActive: p.is_active,
    openTasks: openTasks.get(p.id) ?? 0,
    investorsOwned: investors.get(p.id) ?? 0,
    customersOwned: customers.get(p.id) ?? 0,
    keyResultsOwned: krs.get(p.id) ?? 0,
  }))

  return {
    active: cards.filter((c) => c.isActive),
    former: cards.filter((c) => !c.isActive).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

// ---------------------------------------------------------------------------
// /people/[id]
// ---------------------------------------------------------------------------

export type ProfilePerson = {
  id: string
  name: string
  role: string
  email: string
  avatarUrl: string | null
  contactPreference: string | null
  strengths: string[]
  skills: string[]
  isActive: boolean
}

export type OwnedOrg = {
  id: string
  name: string
  kind: OrgKind
  stageLabel: string
  nextStep: string
  nextStepDate: IsoDate
}

export type OwnedKeyResult = {
  id: string
  title: string
  objectiveTitle: string
  quarterLabel: string | null
  currentValue: number
  targetValue: number
  unit: string | null
  /** 0–100 */
  progress: number
}

export type OwnedTask = {
  id: string
  title: string
  dueDate: IsoDate
  status: Enums<"task_status">
}

export type PersonProfile = {
  person: ProfilePerson
  availability: AvailabilityBlock[]
  crunch: { upcoming: CrunchPeriodView[]; past: CrunchPeriodView[] }
  orgs: OwnedOrg[]
  keyResults: OwnedKeyResult[]
  openTasks: OwnedTask[]
  /** Today in ET, for due dates and crunch timing. */
  today: IsoDate
}

/** The person's name, for the page title. Null when the id doesn't match anyone. */
export const getPersonName = cache(async (id: string): Promise<string | null> => {
  if (!isRecordId(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from("people").select("name").eq("id", id).maybeSingle()
  return data?.name ?? null
})

/**
 * Everything on a profile page, or null when `id` isn't a person (or isn't
 * even an id: that's a 404, not a database error).
 */
export async function getProfile(id: string): Promise<PersonProfile | null> {
  if (!isRecordId(id)) return null
  const supabase = await createClient()

  const person = await supabase
    .from("people")
    .select("id, name, role, email, avatar_url, contact_preference, strengths, skills, is_active")
    .eq("id", id)
    .maybeSingle()
  if (person.error) fail("this profile", person.error)
  if (!person.data) return null

  const [blocks, crunch, orgs, keyResults, tasks] = await Promise.all([
    supabase
      .from("availability_blocks")
      .select("id, weekday, start_time, end_time, label, note")
      .eq("person_id", id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("crunch_periods")
      .select("id, label, start_date, end_date")
      .eq("person_id", id)
      .order("start_date"),
    supabase
      .from("organizations")
      .select("id, name, kind, stage, next_step, next_step_date")
      .eq("owner_id", id)
      .is("archived_at", null)
      .order("next_step_date")
      .order("name"),
    supabase
      .from("key_results")
      .select(
        "id, title, unit, start_value, target_value, current_value, position, objectives!inner(title, archived_at, quarters(label, start_date))",
      )
      .eq("owner_id", id)
      .is("archived_at", null)
      .is("objectives.archived_at", null),
    supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("owner_id", id)
      .is("archived_at", null)
      .neq("status", "done")
      .order("due_date")
      .order("title"),
  ])
  if (blocks.error) fail("availability", blocks.error)
  if (crunch.error) fail("crunch periods", crunch.error)
  if (orgs.error) fail("investors and customers", orgs.error)
  if (keyResults.error) fail("key results", keyResults.error)
  if (tasks.error) fail("open tasks", tasks.error)

  // createClient() waited for the request, so "today" is the request's day.
  const today = todayEt()
  const p = person.data

  return {
    person: {
      id: p.id,
      name: p.name,
      role: p.role,
      email: p.email,
      avatarUrl: p.avatar_url,
      contactPreference: p.contact_preference,
      strengths: p.strengths,
      skills: p.skills,
      isActive: p.is_active,
    },
    availability: blocks.data.map((b) => ({
      id: b.id,
      weekday: b.weekday,
      startTime: toHourMinute(b.start_time),
      endTime: toHourMinute(b.end_time),
      label: b.label,
      note: b.note,
    })),
    crunch: splitCrunchPeriods(
      crunch.data.map((c) => ({
        id: c.id,
        label: c.label,
        startDate: c.start_date,
        endDate: c.end_date,
      })),
      today,
    ),
    orgs: orgs.data
      .filter((o) => isOpenStage(o.kind, o.stage))
      .map((o) => ({
        id: o.id,
        name: o.name,
        kind: o.kind,
        stageLabel: orgStageLabel(o.kind, o.stage),
        nextStep: o.next_step,
        nextStepDate: o.next_step_date,
      })),
    keyResults: keyResults.data
      .map((k) => ({
        id: k.id,
        title: k.title,
        objectiveTitle: k.objectives.title,
        quarterLabel: k.objectives.quarters?.label ?? null,
        quarterStart: k.objectives.quarters?.start_date ?? "",
        position: k.position,
        currentValue: Number(k.current_value),
        targetValue: Number(k.target_value),
        unit: k.unit,
        progress: keyResultProgress({
          start: Number(k.start_value),
          target: Number(k.target_value),
          current: Number(k.current_value),
        }),
      }))
      // Latest quarter first, then the objective's own order.
      .sort(
        (a, b) =>
          b.quarterStart.localeCompare(a.quarterStart) ||
          a.objectiveTitle.localeCompare(b.objectiveTitle) ||
          a.position - b.position,
      )
      .map(({ quarterStart: _q, position: _p, ...kr }) => kr),
    openTasks: tasks.data.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      status: t.status,
    })),
    today,
  }
}
