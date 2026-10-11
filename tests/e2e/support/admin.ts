import { createClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database"
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from "./env"

/**
 * Test data, written and cleaned up with the secret key (it acts as "system", like a script,
 * and never reaches the browser). Every row a spec creates carries the `[e2e]` marker, so
 * `cleanUpE2eRows()` also removes what a crashed run left behind, and never touches seed or
 * [DEMO] rows.
 */
export const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

/** The prefix on every title, label and note a spec creates. */
export const E2E = "[e2e]"

/** "[e2e] Send the deck k3x9q": unique per call, so parallel projects and reruns never collide. */
export function e2eLabel(what: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  return `${E2E} ${what} ${suffix}`
}

const MARKED = `${E2E}%`

type Result<T> = { data: T | null; error: { message: string } | null }

/** The rows a query returned; throws on an error. */
function check<T>(result: Result<T>, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`${what} failed: ${result.error?.message ?? "no data returned"}`)
  }
  return result.data
}

/** Throws if a write without returned rows failed. */
function ok(result: Result<unknown>, what: string): void {
  if (result.error) throw new Error(`${what} failed: ${result.error.message}`)
}

/** The marked text column of each table a spec writes to (also through the UI). */
const MARKED_COLUMNS = {
  tasks: "title",
  organizations: "name",
  crunch_periods: "label",
  availability_blocks: "note",
} as const

/**
 * Delete the audit trail (and overdue-event markers) of `[e2e]` rows: by id for rows being
 * removed now, and by content for rows the UI already deleted (a removed busy time).
 */
async function forgetRows(ids: string[]): Promise<void> {
  if (ids.length > 0) {
    ok(await admin.from("activity_log").delete().in("entity_id", ids), "Deleting audit rows")
    ok(await admin.from("event_dedupe").delete().in("entity_id", ids), "Deleting event markers")
  }
  for (const [table, column] of Object.entries(MARKED_COLUMNS)) {
    ok(
      await admin
        .from("activity_log")
        .delete()
        .eq("entity_type", table)
        .or(`after->>${column}.like.${E2E}*,before->>${column}.like.${E2E}*`),
      `Deleting [e2e] audit rows for ${table}`,
    )
  }
}

/**
 * Remove every `[e2e]` row: tasks, investor/customer meetings and orgs, crunch periods and
 * busy times, plus their audit rows. Safe to run any time (and twice).
 */
export async function cleanUpE2eRows(): Promise<void> {
  const tasks = check(
    await admin.from("tasks").delete().like("title", MARKED).select("id"),
    "Deleting [e2e] tasks",
  )
  const orgs = check(
    await admin.from("organizations").select("id").like("name", MARKED),
    "Reading [e2e] orgs",
  )
  const orgIds = orgs.map((o) => o.id)
  const meetings = orgIds.length
    ? check(
        await admin.from("org_meetings").delete().in("organization_id", orgIds).select("id"),
        "Deleting [e2e] org meetings",
      )
    : []
  if (orgIds.length) {
    ok(await admin.from("organizations").delete().in("id", orgIds), "Deleting [e2e] orgs")
  }
  const crunch = check(
    await admin.from("crunch_periods").delete().like("label", MARKED).select("id"),
    "Deleting [e2e] crunch periods",
  )
  const blocks = check(
    await admin.from("availability_blocks").delete().like("note", MARKED).select("id"),
    "Deleting [e2e] busy times",
  )
  await forgetRows([
    ...tasks.map((r) => r.id),
    ...orgIds,
    ...meetings.map((r) => r.id),
    ...crunch.map((r) => r.id),
    ...blocks.map((r) => r.id),
  ])
}

type ProfileFields = Pick<
  Tables<"people">,
  "name" | "role" | "avatar_url" | "contact_preference" | "strengths" | "skills"
>

/**
 * Snapshot a teammate's editable profile fields, and get back a function that restores them
 * and drops the audit rows the test's edits (and the restore) wrote.
 */
export async function keepProfile(personId: string): Promise<() => Promise<void>> {
  const saved: ProfileFields = check(
    await admin
      .from("people")
      .select("name, role, avatar_url, contact_preference, strengths, skills")
      .eq("id", personId)
      .single(),
    "Reading a profile",
  )
  const since = new Date().toISOString()
  return async () => {
    ok(await admin.from("people").update(saved).eq("id", personId), "Restoring a profile")
    ok(
      await admin
        .from("activity_log")
        .delete()
        .eq("entity_type", "people")
        .eq("entity_id", personId)
        .gte("occurred_at", since),
      "Deleting profile audit rows",
    )
  }
}

/** An `[e2e]` task written straight to the database (as "system"). */
export async function createTask(
  fields: Pick<Tables<"tasks">, "title" | "owner_id" | "due_date"> &
    Partial<Pick<Tables<"tasks">, "next_action" | "status" | "priority">>,
): Promise<{ id: string }> {
  if (!fields.title.startsWith(E2E)) throw new Error(`Test task titles start with ${E2E}`)
  return check(
    await admin
      .from("tasks")
      .insert({ next_action: "Check the e2e result", ...fields })
      .select("id")
      .single(),
    "Adding an [e2e] task",
  )
}

/** An `[e2e]` crunch period written straight to the database. */
export async function createCrunchPeriod(
  fields: Pick<Tables<"crunch_periods">, "person_id" | "label" | "start_date" | "end_date">,
): Promise<{ id: string }> {
  if (!fields.label.startsWith(E2E)) throw new Error(`Test labels start with ${E2E}`)
  return check(
    await admin.from("crunch_periods").insert(fields).select("id").single(),
    "Adding an [e2e] crunch period",
  )
}

/** An `[e2e]` weekly busy time written straight to the database (marked by its note). */
export async function createBusyTime(
  fields: Pick<
    Tables<"availability_blocks">,
    "person_id" | "weekday" | "start_time" | "end_time" | "label"
  >,
): Promise<{ id: string }> {
  return check(
    await admin
      .from("availability_blocks")
      .insert({ ...fields, note: `${E2E} busy time` })
      .select("id")
      .single(),
    "Adding an [e2e] busy time",
  )
}

/** An `[e2e]` investor with one meeting at `startsAt`. */
export async function createOrgMeeting({
  name,
  ownerId,
  nextStepDate,
  startsAt,
}: {
  name: string
  ownerId: string
  nextStepDate: string
  startsAt: string
}): Promise<{ orgId: string; meetingId: string }> {
  if (!name.startsWith(E2E)) throw new Error(`Test org names start with ${E2E}`)
  const org = check<{ id: string }>(
    await admin
      .from("organizations")
      .insert({
        kind: "investor",
        name,
        owner_id: ownerId,
        next_step: "Send the e2e deck",
        next_step_date: nextStepDate,
      })
      .select("id")
      .single(),
    "Adding an [e2e] org",
  )
  const meeting = check<{ id: string }>(
    await admin
      .from("org_meetings")
      .insert({ organization_id: org.id, starts_at: startsAt })
      .select("id")
      .single(),
    "Adding an [e2e] org meeting",
  )
  return { orgId: org.id, meetingId: meeting.id }
}
