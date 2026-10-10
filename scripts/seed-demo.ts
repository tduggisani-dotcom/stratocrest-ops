/**
 * pnpm seed:demo — example data for local development ONLY (spec §7).
 *
 * Refuses to run against production or any remote project (unless
 * ALLOW_REMOTE_DEMO=1). Every record it creates is labeled "[DEMO]" and is
 * replaced on each run: previous demo rows are removed first. Dates are
 * relative to today (ET), so the data always looks current.
 *
 * Needs the people from `pnpm seed`. Runs as "system" (no x-actor-id header).
 */
import { addDays, etMoment, todayEt } from "../src/lib/dates.ts"
import type { Database } from "../src/types/database.ts"
import {
  check,
  createSeedClient,
  demoSeedBlockReason,
  readEnv,
  runScript,
} from "./lib/seed-helpers.ts"
import type { SeedClient } from "./lib/seed-helpers.ts"

type Tables = Database["public"]["Tables"]

const DEMO = "[DEMO] "
const DEMO_NOTE = "Example data from pnpm seed:demo. Safe to delete."

await runScript("pnpm seed:demo", async () => {
  const blocked = demoSeedBlockReason()
  if (blocked) throw new Error(`Refusing to load demo data. ${blocked}`)

  const env = readEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"])
  const supabase = createSeedClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)
  console.log(`Loading demo data into ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}\n`)

  const people = check(
    await supabase.from("people").select("id, name").eq("is_active", true).order("sort_order"),
    "Couldn't read people",
  )
  if (people.length === 0) {
    throw new Error("There are no people yet. Run `pnpm seed` first, then `pnpm seed:demo`.")
  }
  // Owner by position in the team order (wraps if the team is smaller).
  const owner = (index: number) => people[index % people.length].id

  await removeDemoRows(supabase)
  const created = await createDemoRows(supabase, owner, todayEt())

  console.log(
    `Created ${created.investors} investors, ${created.customers} customers, ` +
      `${created.meetings} org meetings, ${created.tasks} tasks, ` +
      `${created.hypotheses} hypotheses (all labeled "[DEMO]").`,
  )
  console.log("\nDone.")
})

/** Removes everything a previous run created (matched by the "[DEMO] " prefix). */
async function removeDemoRows(supabase: SeedClient) {
  const tasks = check(
    await supabase.from("tasks").delete().like("title", `${DEMO}%`).select("id"),
    "Couldn't remove demo tasks",
  )
  const orgIds = check(
    await supabase.from("organizations").select("id").like("name", `${DEMO}%`),
    "Couldn't read demo organizations",
  ).map((org) => org.id)

  let hypotheses = check(
    await supabase.from("hypotheses").delete().like("statement", `${DEMO}%`).select("id"),
    "Couldn't remove demo hypotheses",
  ).length
  let meetings = 0
  if (orgIds.length > 0) {
    // Order matters: hypotheses and meetings point at the orgs. Debriefs,
    // attendees and attached checklists go with their meeting or org (cascade).
    hypotheses += check(
      await supabase.from("hypotheses").delete().in("organization_id", orgIds).select("id"),
      "Couldn't remove hypotheses linked to demo organizations",
    ).length
    meetings = check(
      await supabase.from("org_meetings").delete().in("organization_id", orgIds).select("id"),
      "Couldn't remove demo org meetings",
    ).length
    check(
      await supabase.from("organizations").delete().in("id", orgIds),
      "Couldn't remove demo organizations",
    )
  }
  console.log(
    `Removed previous demo data: ${orgIds.length} organizations, ${meetings} meetings, ` +
      `${tasks.length} tasks, ${hypotheses} hypotheses`,
  )
}

async function createDemoRows(
  supabase: SeedClient,
  owner: (index: number) => string,
  today: string,
) {
  const day = (offset: number) => addDays(today, offset)
  const at = (offset: number, time: string) => etMoment(day(offset), time).toISOString()

  // --- Organizations: 3 investors, 2 customers, in different stages and regions.
  // Rows leave out different optional columns: insert with defaultToNull false
  // so a missing column gets its database default (e.g. status), not null.
  const orgRows: Tables["organizations"]["Insert"][] = [
    {
      kind: "investor",
      name: `${DEMO}Example Seed Fund`,
      stage: "meeting",
      subtype: "vc",
      owner_id: owner(0),
      next_step: "Send the one-page summary they asked for",
      next_step_date: day(2),
      contact_name: `${DEMO}Contact`,
      contact_title: "Partner",
      city: "Akron",
      state_or_country: "OH",
      region: "ohio",
      first_contact_date: day(-30),
      first_contact_method: "synthe6_event",
      notes: DEMO_NOTE,
    },
    {
      kind: "investor",
      name: `${DEMO}Example Angel Network`,
      stage: "contacted",
      subtype: "angel",
      owner_id: owner(1),
      // Overdue follow-up and no contact for 18 days: shows as stale.
      next_step: "Follow up on the intro email with two meeting times",
      next_step_date: day(-2),
      city: "Chicago",
      state_or_country: "IL",
      region: "midwest",
      first_contact_date: day(-18),
      first_contact_method: "cold_email",
      last_contact_date: day(-18),
      notes: DEMO_NOTE,
    },
    {
      kind: "investor",
      name: `${DEMO}Example Grant Program`,
      stage: "diligence",
      subtype: "grant_program",
      owner_id: owner(3),
      next_step: "Draft the budget section of the application",
      next_step_date: day(10),
      state_or_country: "DC",
      region: "rest_of_us",
      first_contact_date: day(-45),
      first_contact_method: "warm_intro",
      introduced_by: `${DEMO}Example mentor`,
      notes: DEMO_NOTE,
    },
    {
      kind: "customer",
      name: `${DEMO}Example Construction Co.`,
      stage: "discovery",
      subtype: "construction_firm",
      owner_id: owner(2),
      next_step: "Confirm a date for the site visit",
      next_step_date: day(3),
      city: "Cleveland",
      state_or_country: "OH",
      region: "ohio",
      first_contact_date: day(-25),
      first_contact_method: "conference",
      notes: DEMO_NOTE,
    },
    {
      kind: "customer",
      name: `${DEMO}Example Safety Supply`,
      stage: "pilot_proposed",
      subtype: "safety_distributor",
      owner_id: owner(5),
      next_step: "Send the pilot proposal draft",
      next_step_date: day(7),
      city: "Toronto",
      state_or_country: "Canada",
      region: "international",
      first_contact_date: day(-40),
      first_contact_method: "warm_intro",
      notes: DEMO_NOTE,
    },
  ]
  const orgs = check(
    await supabase
      .from("organizations")
      .insert(orgRows, { defaultToNull: false })
      .select("id, name, kind"),
    "Couldn't create demo organizations",
  )
  const orgId = (name: string) => orgs.find((org) => org.name === `${DEMO}${name}`)!.id

  // --- Org meetings: three past (rated 2–5, one-line summaries), one upcoming.
  const meetingRows: Array<Tables["org_meetings"]["Insert"] & { attendees: number[] }> = [
    {
      organization_id: orgId("Example Seed Fund"),
      starts_at: at(-21, "10:00"),
      rating: 3,
      summary: `${DEMO}First call. Interested, wants to see test data.`,
      attendees: [0, 1],
    },
    {
      organization_id: orgId("Example Seed Fund"),
      starts_at: at(-6, "14:00"),
      rating: 5,
      summary: `${DEMO}Strong second meeting. Asked for a one-page summary.`,
      follow_up_owner_id: owner(0),
      follow_up_date: day(2),
      attendees: [0, 3],
    },
    {
      organization_id: orgId("Example Construction Co."),
      starts_at: at(-9, "11:00"),
      rating: 2,
      summary: `${DEMO}Early call. Not a priority for them this quarter.`,
      attendees: [2],
    },
    {
      organization_id: orgId("Example Safety Supply"),
      starts_at: at(4, "15:00"),
      attendees: [5, 2],
    },
  ]
  for (const { attendees, ...meeting } of meetingRows) {
    const row = check(
      await supabase.from("org_meetings").insert(meeting).select("id").single(),
      "Couldn't create a demo org meeting",
    )
    const people = [...new Set(attendees.map(owner))]
    check(
      await supabase
        .from("org_meeting_attendees")
        .insert(people.map((personId) => ({ org_meeting_id: row.id, person_id: personId }))),
      "Couldn't add demo meeting attendees",
    )
  }

  // --- Tasks: one overdue, one due soon, one in progress, one done.
  const taskRows: Tables["tasks"]["Insert"][] = [
    {
      title: `${DEMO}Send one-page summary to Example Seed Fund`,
      next_action: "Export the latest one-pager to PDF and email it",
      owner_id: owner(0),
      due_date: day(2),
      priority: "high",
      organization_id: orgId("Example Seed Fund"),
    },
    {
      title: `${DEMO}Follow up with Example Angel Network`,
      next_action: "Reply to the intro thread with two meeting times",
      owner_id: owner(1),
      due_date: day(-3),
      organization_id: orgId("Example Angel Network"),
    },
    {
      title: `${DEMO}Draft the grant budget section`,
      next_action: "List the cost categories in the budget template",
      owner_id: owner(3),
      due_date: day(10),
      status: "in_progress",
      organization_id: orgId("Example Grant Program"),
    },
    {
      title: `${DEMO}Prepare site visit questions`,
      next_action: "Write the discovery questions in the shared doc",
      owner_id: owner(2),
      due_date: day(-1),
      status: "done",
      priority: "low",
      organization_id: orgId("Example Construction Co."),
    },
  ]
  check(
    await supabase.from("tasks").insert(taskRows, { defaultToNull: false }),
    "Couldn't create demo tasks",
  )

  // --- Hypotheses: one linked to an investor, one across customers.
  const hypothesisRows: Tables["hypotheses"]["Insert"][] = [
    {
      organization_id: orgId("Example Seed Fund"),
      owner_id: owner(0),
      statement: `${DEMO}Example: this investor needs third-party test data before a second meeting.`,
      test_plan: "Ask what evidence they need before the next meeting.",
      success_criterion: "They name test data as a requirement.",
    },
    {
      audience: "customer",
      owner_id: owner(5),
      statement: `${DEMO}Example: distributors will trial a liner that fits existing hard hats.`,
      test_plan: "Ask in each distributor discovery call.",
      success_criterion: "Most distributors we ask agree to a trial.",
      status: "validated",
      result: "Example result: the distributors we asked agreed.",
      learning: "Example learning: fit with existing hard hats matters most.",
      decision: "persevere",
    },
  ]
  check(
    await supabase.from("hypotheses").insert(hypothesisRows, { defaultToNull: false }),
    "Couldn't create demo hypotheses",
  )

  return {
    investors: orgRows.filter((org) => org.kind === "investor").length,
    customers: orgRows.filter((org) => org.kind === "customer").length,
    meetings: meetingRows.length,
    tasks: taskRows.length,
    hypotheses: hypothesisRows.length,
  }
}
