/**
 * pnpm seed — production-safe, idempotent setup data (spec §7, DATA_MODEL §7).
 *
 * Writes only: the six people and their logins (emails from TEAM_EMAILS), the
 * Synthe6 schedule, the four quarters, the starter checklist templates, and
 * app_settings.automation_start_date. Safe to re-run: it fills in what's
 * missing, corrects schedule/people fields it owns, and never touches the
 * team's own edits (session owners, notes, edited templates, profiles).
 *
 * Runs with the secret key and no x-actor-id header, so the audit log records
 * the changes as "system".
 */
import { todayEt } from "../src/lib/dates.ts"
import { parseTeamEmails } from "../src/lib/team-emails.ts"
import type { Database } from "../src/types/database.ts"
import { CHECKLIST_TEMPLATES } from "./data/checklist-templates.ts"
import { QUARTERS } from "./data/quarters.ts"
import { SCHEDULE_COLUMNS, SYNTHE6_SCHEDULE } from "./data/synthe6-schedule.ts"
import { TEAM } from "./data/team.ts"
import {
  check,
  createSeedClient,
  maskEmail,
  matchTeamEmails,
  readEnv,
  runScript,
} from "./lib/seed-helpers.ts"
import type { SeedClient } from "./lib/seed-helpers.ts"

type Tables = Database["public"]["Tables"]
type Seeded = Array<(typeof TEAM)[number] & { email: string; id: string }>

await runScript("pnpm seed", async () => {
  const env = readEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "TEAM_EMAILS"])
  const team = matchTeamEmails(parseTeamEmails(env.TEAM_EMAILS), TEAM)
  const supabase = createSeedClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

  console.log(`Seeding ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}\n`)

  const people = await seedPeople(supabase, team)
  await seedLogins(supabase, people)
  await seedSchedule(supabase)
  await seedQuarters(supabase)
  await seedChecklistTemplates(supabase)
  await seedAutomationStartDate(supabase)
  await runScheduledChecks(supabase, people)

  console.log("\nDone.")
})

/** Creates missing people; keeps email, role and rotation order in line with the seed. */
async function seedPeople(
  supabase: SeedClient,
  team: ReturnType<typeof matchTeamEmails>,
): Promise<Seeded> {
  const existing = check(
    await supabase.from("people").select("id, name, role, email, sort_order"),
    "Couldn't read people",
  )
  const seeded: Seeded = []
  let created = 0
  let updated = 0

  for (const member of team) {
    const match =
      existing.find((p) => p.email.toLowerCase() === member.email) ??
      existing.find((p) => p.name.toLowerCase() === member.name.toLowerCase())

    if (!match) {
      const row = check(
        await supabase
          .from("people")
          .insert({
            name: member.name,
            role: member.role,
            email: member.email,
            sort_order: member.sort_order,
          })
          .select("id")
          .single(),
        `Couldn't add ${member.name}`,
      )
      seeded.push({ ...member, id: row.id })
      created++
      continue
    }

    // Only the fields the seed owns. Name, avatar, strengths etc. are the team's.
    const patch: Tables["people"]["Update"] = {}
    if (match.email.toLowerCase() !== member.email) patch.email = member.email
    if (match.role !== member.role) patch.role = member.role
    if (match.sort_order !== member.sort_order) patch.sort_order = member.sort_order
    if (Object.keys(patch).length > 0) {
      check(
        await supabase.from("people").update(patch).eq("id", match.id),
        `Couldn't update ${member.name}`,
      )
      updated++
    }
    seeded.push({ ...member, id: match.id })
  }

  console.log(`People: ${created} added, ${updated} updated, ${team.length} on the team`)
  for (const person of seeded) {
    console.log(
      `  ${person.sort_order}. ${person.name} (${person.role}) ${maskEmail(person.email)}`,
    )
  }
  return seeded
}

/** Every person gets a confirmed login, linked through people.auth_user_id. */
async function seedLogins(supabase: SeedClient, people: Seeded) {
  const userIds = await listAuthUsers(supabase)
  let created = 0
  let linked = 0

  for (const person of people) {
    const existing = userIds.get(person.email)
    if (existing && !existing.confirmed) {
      // Someone may have signed up with this address before it was on the team. Don't adopt
      // (or confirm) that login: a person deletes it after checking, then the seed creates a
      // fresh confirmed one.
      throw new Error(
        `A login for ${maskEmail(person.email)} exists but was never confirmed, so it may not ` +
          `belong to ${person.name}. Delete it in Supabase → Authentication → Users, then run ` +
          `the seed again.`,
      )
    }
    let userId = existing?.id
    if (!userId) {
      // Creating the login also links it to the person (database trigger).
      const { data, error } = await supabase.auth.admin.createUser({
        email: person.email,
        email_confirm: true,
      })
      if (error) throw new Error(`Couldn't create the login for ${person.name}: ${error.message}`)
      userId = data.user.id
      created++
    }

    const row = check(
      await supabase.from("people").select("auth_user_id").eq("id", person.id).single(),
      `Couldn't read ${person.name}`,
    )
    if (row.auth_user_id !== userId) {
      check(
        await supabase.from("people").update({ auth_user_id: userId }).eq("id", person.id),
        `Couldn't link the login for ${person.name}`,
      )
      linked++
    }
  }

  console.log(`Logins: ${created} created, ${linked} re-linked, ${people.length} ready`)
}

/** email (lowercase) → auth user id and whether its email is confirmed, across every page. */
async function listAuthUsers(
  supabase: SeedClient,
): Promise<Map<string, { id: string; confirmed: boolean }>> {
  const perPage = 1000
  const users = new Map<string, { id: string; confirmed: boolean }>()
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Couldn't list logins: ${error.message}`)
    for (const user of data.users) {
      if (user.email) {
        users.set(user.email.toLowerCase(), {
          id: user.id,
          confirmed: Boolean(user.email_confirmed_at),
        })
      }
    }
    if (data.users.length < perPage) return users
  }
}

/** Upserts the schedule on start_date, writing only the schedule columns. */
async function seedSchedule(supabase: SeedClient) {
  const existing = check(
    await supabase
      .from("synthe6_sessions")
      .select(
        "week_number, week_label, start_date, end_date, format, activity_type, topic, is_break, emphasis",
      ),
    "Couldn't read the Synthe6 schedule",
  )
  const byStart = new Map(existing.map((row) => [row.start_date, row]))

  const added = SYNTHE6_SCHEDULE.filter((row) => !byStart.has(row.start_date))
  const changed = SYNTHE6_SCHEDULE.filter((row) => {
    const current = byStart.get(row.start_date)
    return current && SCHEDULE_COLUMNS.some((column) => current[column] !== row[column])
  })

  if (added.length + changed.length > 0) {
    check(
      await supabase
        .from("synthe6_sessions")
        .upsert([...added, ...changed], { onConflict: "start_date" }),
      "Couldn't save the Synthe6 schedule",
    )
  }
  console.log(
    `Synthe6 sessions: ${added.length} added, ${changed.length} corrected, ` +
      `${SYNTHE6_SCHEDULE.length} in the schedule`,
  )
}

/** Upserts the quarters on label, linking each to its share-out session. */
async function seedQuarters(supabase: SeedClient) {
  const sessions = check(
    await supabase
      .from("synthe6_sessions")
      .select("id, week_label")
      .in(
        "week_label",
        QUARTERS.map((q) => q.share_out_week_label),
      ),
    "Couldn't read the share-out sessions",
  )
  const rows: Tables["quarters"]["Insert"][] = QUARTERS.map((quarter) => {
    const session = sessions.find((s) => s.week_label === quarter.share_out_week_label)
    if (!session) throw new Error(`No ${quarter.share_out_week_label} session for ${quarter.label}`)
    return {
      label: quarter.label,
      start_date: quarter.start_date,
      end_date: quarter.end_date,
      share_out_date: quarter.share_out_date,
      share_out_session_id: session.id,
    }
  })

  const existing = check(
    await supabase
      .from("quarters")
      .select("label, start_date, end_date, share_out_date, share_out_session_id"),
    "Couldn't read quarters",
  )
  const added = rows.filter((row) => !existing.some((q) => q.label === row.label))
  const changed = rows.filter((row) => {
    const current = existing.find((q) => q.label === row.label)
    return (
      current &&
      (current.start_date !== row.start_date ||
        current.end_date !== row.end_date ||
        current.share_out_date !== row.share_out_date ||
        current.share_out_session_id !== row.share_out_session_id)
    )
  })

  if (added.length + changed.length > 0) {
    check(
      await supabase.from("quarters").upsert([...added, ...changed], { onConflict: "label" }),
      "Couldn't save quarters",
    )
  }
  console.log(`Quarters: ${added.length} added, ${changed.length} corrected`)
}

/** Adds starter templates whose name isn't taken. Never overwrites the team's edits. */
async function seedChecklistTemplates(supabase: SeedClient) {
  // Archived ones count too: if the team archived a starter, it stays archived.
  const existing = check(
    await supabase.from("checklist_templates").select("name"),
    "Couldn't read checklist templates",
  )
  const taken = new Set(existing.map((t) => t.name.toLowerCase()))
  const added = CHECKLIST_TEMPLATES.filter((t) => !taken.has(t.name.toLowerCase()))

  if (added.length > 0) {
    check(
      await supabase.from("checklist_templates").insert(
        added.map((t) => ({
          name: t.name,
          description: t.description,
          items: t.items.map((item) => ({ ...item })),
        })),
      ),
      "Couldn't add checklist templates",
    )
  }
  console.log(
    `Checklist templates: ${added.length} added, ` +
      `${CHECKLIST_TEMPLATES.length - added.length} already there`,
  )
}

/** Automatic debriefs count from the first seed onward (no backlog on day one). */
async function seedAutomationStartDate(supabase: SeedClient) {
  const inserted = check(
    await supabase
      .from("app_settings")
      .upsert(
        { key: "automation_start_date", value: todayEt() },
        { onConflict: "key", ignoreDuplicates: true },
      )
      .select("key"),
    "Couldn't save automation_start_date",
  )
  const current = check(
    await supabase.from("app_settings").select("value").eq("key", "automation_start_date").single(),
    "Couldn't read automation_start_date",
  )
  console.log(
    `Automation start date: ${String(current.value)}` +
      (inserted.length > 0 ? " (set now)" : " (already set)"),
  )
}

/** Creates the next Sunday meeting (and anything else that's due) right away. */
async function runScheduledChecks(supabase: SeedClient, people: Seeded) {
  const result = check(await supabase.rpc("run_scheduled_checks"), "Scheduled checks failed")
  const next = check(
    await supabase
      .from("team_meetings")
      .select("meeting_date, facilitator_id")
      .eq("status", "upcoming")
      .order("meeting_date")
      .limit(1)
      .maybeSingle(),
    "Couldn't read the next Sunday meeting",
  )
  console.log(`Scheduled checks: ${JSON.stringify(result)}`)
  if (next) {
    const facilitator = people.find((p) => p.id === next.facilitator_id)?.name ?? "someone"
    console.log(`Next Sunday meeting: ${next.meeting_date}, facilitated by ${facilitator}`)
  }
}
