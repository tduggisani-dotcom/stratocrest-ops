import { afterAll, describe, expect, test } from "vitest"
import {
  SqlState,
  actAs,
  actAsAnon,
  actAsService,
  closeDb,
  createAuthUser,
  createObjective,
  createOrg,
  createOrgMeeting,
  createPerson,
  createTask,
  createTeammate,
  freeWeekNumbers,
  insert,
  json,
  quarterId,
  resetRole,
  rows,
  scalar,
  sql,
  sqlError,
  uniqueSuffix,
  update,
  visibleRows,
  withTx,
  type Db,
  type TableName,
  type Updatable,
} from "./helpers"

/**
 * Row Level Security and table privileges (docs/DATA_MODEL.md §6): signed-out
 * visitors and anyone who isn't an active teammate see nothing; teammates read
 * and edit everything but hard-delete only a few small things; server-only
 * tables and the scheduled checks are out of reach.
 */

afterAll(closeDb)

/** Tables every active teammate can read, add to and edit (no delete unless listed below). */
const TEAM_TABLES = [
  "action_items",
  "availability_blocks",
  "candidates",
  "checklist_items",
  "checklist_templates",
  "checklists",
  "crunch_periods",
  "debriefs",
  "decisions",
  "hypotheses",
  "hypothesis_tests",
  "key_results",
  "meeting_updates",
  "objectives",
  "org_meeting_attendees",
  "org_meetings",
  "organizations",
  "synthe6_sessions",
  "tasks",
  "team_meetings",
] as const satisfies readonly TableName[]

/** The only tables a teammate can hard-delete from (everything else is archived). */
const DELETABLE = [
  "action_items",
  "availability_blocks",
  "checklist_items",
  "crunch_periods",
  "org_meeting_attendees",
]

const VIEWS = ["org_overview", "person_workload", "wins_feed"]

/** Every table and view in `public`, so new ones are covered automatically. */
async function publicRelations(db: Db): Promise<string[]> {
  const result = await rows<{ relname: string }>(
    db,
    `select relname from pg_class
      where relnamespace = 'public'::regnamespace and relkind in ('r', 'v', 'm', 'p')
      order by relname`,
  )
  return result.map((r) => r.relname)
}

/** A row in every table a teammate can write to (runs as the current role). */
async function createOneOfEverything(db: Db, me: string, quarter: string) {
  const suffix = uniqueSuffix()
  const [week] = await freeWeekNumbers(db, 1)
  const session = await insert(db, "synthe6_sessions", {
    week_number: week,
    week_label: `W${week}`,
    start_date: "2001-01-01",
    end_date: "2001-01-02",
    format: "In person",
    activity_type: "Workshop",
  })
  const org = await createOrg(db, { owner_id: me })
  const meeting = await createOrgMeeting(db, {
    organization_id: org.id,
    starts_at: sql("now() - interval '1 day'"),
    rating: 4,
  })
  const attendee = await insert(db, "org_meeting_attendees", {
    org_meeting_id: meeting.id,
    person_id: me,
  })
  const hypothesis = await insert(db, "hypotheses", {
    organization_id: org.id,
    statement: "Test hypothesis",
  })
  const hypothesisTest = await insert(db, "hypothesis_tests", {
    hypothesis_id: hypothesis.id,
    org_meeting_id: meeting.id,
    test_date: sql("app.today_et()"),
    outcome: "supports",
    evidence: "Test evidence",
  })
  const objective = await createObjective(db, me, quarter)
  const keyResult = await insert(db, "key_results", {
    objective_id: objective.id,
    title: "Test key result",
    target_value: 10,
    owner_id: me,
  })
  const teamMeeting = await insert(db, "team_meetings", {
    meeting_date: "2001-01-07",
    facilitator_id: me,
  })
  const meetingUpdate = await insert(db, "meeting_updates", {
    team_meeting_id: teamMeeting.id,
    person_id: me,
    decision_needed: "Test agenda item",
  })
  const decision = await insert(db, "decisions", {
    team_meeting_id: teamMeeting.id,
    statement: "Test decision",
    decision_date: sql("app.today_et()"),
  })
  const debrief = await insert(db, "debriefs", {
    kind: "team_meeting",
    team_meeting_id: teamMeeting.id,
    due_date: sql("app.today_et()"),
  })
  const task = await createTask(db, { owner_id: me, organization_id: org.id, status: "done" })
  const actionItem = await insert(db, "action_items", {
    team_meeting_id: teamMeeting.id,
    description: "Test action item",
  })
  const template = await insert(db, "checklist_templates", {
    name: `Test template ${suffix}`,
    items: json([{ text: "Test step" }]),
  })
  const checklist = await insert(db, "checklists", {
    title: "Test checklist",
    task_id: task.id,
    template_id: template.id,
  })
  const checklistItem = await insert(db, "checklist_items", {
    checklist_id: checklist.id,
    position: 1,
    text: "Test step",
  })
  const availability = await insert(db, "availability_blocks", {
    person_id: me,
    weekday: 1,
    start_time: "09:00",
    end_time: "10:00",
    label: "class",
  })
  const crunch = await insert(db, "crunch_periods", {
    person_id: me,
    start_date: sql("app.today_et()"),
    end_date: sql("app.today_et() + 3"),
    label: "Test crunch",
  })
  const candidate = await insert(db, "candidates", {
    name: "Test Candidate",
    role_sought: "Test role",
    owner_id: me,
  })
  const help = await insert(db, "help_requests", { requester_id: me, message: "Test request" })
  const feedback = await insert(db, "feedback", {
    person_id: me,
    page_path: "/",
    message: "Test feedback",
  })
  await insert(db, "usage_events", { person_id: me, kind: "page_view", section: "home", path: "/" })

  return {
    action_items: actionItem.id,
    availability_blocks: availability.id,
    candidates: candidate.id,
    checklist_items: checklistItem.id,
    checklist_templates: template.id,
    checklists: checklist.id,
    crunch_periods: crunch.id,
    debriefs: debrief.id,
    decisions: decision.id,
    hypotheses: hypothesis.id,
    hypothesis_tests: hypothesisTest.id,
    key_results: keyResult.id,
    meeting_updates: meetingUpdate.id,
    objectives: objective.id,
    org_meeting_attendees: attendee.id,
    org_meetings: meeting.id,
    organizations: org.id,
    synthe6_sessions: session.id,
    tasks: task.id,
    team_meetings: teamMeeting.id,
    help_requests: help.id,
    feedback: feedback.id,
  }
}

/** One harmless edit per team table, for the "teammates can edit" check. */
function edits(me: string) {
  const edit = <T extends TableName>(table: T, values: Updatable<T>) => ({
    table,
    apply: (db: Db, id: string) => update(db, table, id, values),
  })
  return [
    edit("action_items", { description: "Edited action item" }),
    edit("availability_blocks", { note: "Edited" }),
    edit("candidates", { notes: "Edited" }),
    edit("checklist_items", { hint: "Edited" }),
    edit("checklist_templates", { description: "Edited" }),
    edit("checklists", { title: "Edited checklist" }),
    edit("crunch_periods", { label: "Edited crunch" }),
    edit("debriefs", { planned: "Edited" }),
    edit("decisions", { rationale: "Edited" }),
    edit("hypotheses", { test_plan: "Edited" }),
    edit("hypothesis_tests", { evidence: "Edited evidence" }),
    edit("key_results", { current_value: 3 }),
    edit("meeting_updates", { blocked_on: "Edited" }),
    edit("objectives", { description: "Edited" }),
    edit("org_meeting_attendees", { person_id: me }),
    edit("org_meetings", { summary: "Edited" }),
    edit("organizations", { notes: "Edited" }),
    edit("synthe6_sessions", { topic: "Edited" }),
    edit("tasks", { notes: "Edited" }),
    edit("team_meetings", { notes: "Edited" }),
  ]
}

/** As postgres: a teammate, one row everywhere, and a row in each server-only table. */
async function populate(db: Db) {
  const teammate = await createTeammate(db)
  const quarter = await quarterId(db)
  const ids = await createOneOfEverything(db, teammate.id, quarter)
  await db.query(
    `insert into public.app_settings (key, value) values ('db_test_setting', '1')
     on conflict (key) do nothing`,
  )
  await db.query(
    "insert into public.event_dedupe (event, entity_id) values ('db.test', gen_random_uuid())",
  )
  return { teammate, ids }
}

/** Every relation is either refused outright or shows zero rows. */
async function expectNothingVisible(db: Db) {
  const relations = await publicRelations(db)
  const seen: Record<string, number | "denied"> = {}
  for (const relation of relations) seen[relation] = await visibleRows(db, relation)
  const leaks = Object.entries(seen).filter(([, outcome]) => outcome !== "denied" && outcome !== 0)
  expect(leaks).toEqual([])
}

describe("schema-wide guarantees", () => {
  test("every table in public has Row Level Security turned on", async () => {
    await withTx(async (db) => {
      const unprotected = await rows(
        db,
        `select relname from pg_class
          where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity`,
      )
      expect(unprotected).toEqual([])
    })
  })

  test("the three views run with the caller's rights (security_invoker)", async () => {
    await withTx(async (db) => {
      const views = await rows<{ relname: string; options: string[] | null }>(
        db,
        `select relname, reloptions as options from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'v' order by relname`,
      )
      expect(views.map((v) => v.relname)).toEqual(VIEWS)
      for (const view of views) expect(view.options).toContain("security_invoker=true")
    })
  })

  test("signed-out visitors have no privileges on any table, view or function", async () => {
    await withTx(async (db) => {
      const tableGrants = await rows(
        db,
        `select c.relname, p.privilege
           from pg_class c
          cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege)
          where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p')
            and has_table_privilege('anon', c.oid, p.privilege)`,
      )
      expect(tableGrants).toEqual([])
      const functionGrants = await rows(
        db,
        `select p.oid::regprocedure::text as fn from pg_proc p
          where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')`,
      )
      expect(functionGrants).toEqual([])
      expect(await scalar(db, "select has_schema_privilege('anon', 'app', 'usage')")).toBe(false)
    })
  })

  test("nobody but the owner and the server can TRUNCATE, and teammates can't truncate in practice", async () => {
    await withTx(async (db) => {
      const truncatable = await rows(
        db,
        `select c.relname, r.role from pg_class c
          cross join unnest(array['anon', 'authenticated']) r(role)
          where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
            and (has_table_privilege(r.role, c.oid, 'TRUNCATE')
              or has_table_privilege(r.role, c.oid, 'REFERENCES')
              or has_table_privilege(r.role, c.oid, 'TRIGGER'))`,
      )
      expect(truncatable).toEqual([])

      const teammate = await createTeammate(db)
      await actAs(db, teammate.authUserId)
      for (const table of ["tasks", "organizations", "activity_log", "people"]) {
        const error = await sqlError(db, `truncate public.${table}`)
        expect(error.code).toBe(SqlState.insufficientPrivilege)
      }
    })
  })

  test("teammates can add rows exactly to the team tables, help requests, feedback and usage events", async () => {
    await withTx(async (db) => {
      const insertable = await rows<{ relname: string }>(
        db,
        `select relname from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r'
            and has_table_privilege('authenticated', oid, 'INSERT')
          order by relname`,
      )
      expect(insertable.map((r) => r.relname)).toEqual(
        [...TEAM_TABLES, "feedback", "help_requests", "usage_events"].sort(),
      )
    })
  })

  test("teammates can hard-delete only availability, crunch periods, attendees, checklist items and action items", async () => {
    await withTx(async (db) => {
      const deletable = await rows<{ relname: string }>(
        db,
        `select relname from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r'
            and has_table_privilege('authenticated', oid, 'DELETE')
          order by relname`,
      )
      expect(deletable.map((r) => r.relname)).toEqual(DELETABLE)
    })
  })
})

describe("signed-out visitors (anon)", () => {
  test("are refused or see zero rows on every table and view", async () => {
    await withTx(async (db) => {
      await populate(db)
      const relations = await publicRelations(db)
      expect(relations).toEqual(expect.arrayContaining([...TEAM_TABLES, ...VIEWS]))
      // Sanity: there is something to hide in every relation.
      for (const relation of relations) {
        expect(await visibleRows(db, relation), relation).toBeGreaterThan(0)
      }

      await actAsAnon(db)
      await expectNothingVisible(db)
    })
  })

  test("cannot add, edit or delete anything", async () => {
    await withTx(async (db) => {
      const { teammate, ids } = await populate(db)
      await actAsAnon(db)
      const insertError = await sqlError(db, () =>
        createOrg(db, { owner_id: teammate.id, next_step_date: "2030-01-01" }),
      )
      expect(insertError.code).toBe(SqlState.insufficientPrivilege)
      const updateError = await sqlError(db, () =>
        update(db, "organizations", ids.organizations, { notes: "x" }),
      )
      expect(updateError.code).toBe(SqlState.insufficientPrivilege)
      const deleteError = await sqlError(db, "delete from public.availability_blocks")
      expect(deleteError.code).toBe(SqlState.insufficientPrivilege)
    })
  })
})

describe("logins that aren't active teammates", () => {
  test("an inactive person sees zero rows everywhere and can't write", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      const former = await createTeammate(db, { isActive: false })
      await actAs(db, former.authUserId)
      await expectNothingVisible(db)

      const error = await sqlError(db, () => createOrg(db, { owner_id: teammate.id }))
      expect(error.code).toBe(SqlState.insufficientPrivilege)
      expect(error.message).toMatch(/row-level security/)
    })
  })

  test("a login with no person row sees zero rows everywhere and can't write", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      const stranger = await createAuthUser(db, `stranger-${uniqueSuffix()}@example.test`)
      await actAs(db, stranger)
      await expectNothingVisible(db)

      const error = await sqlError(db, () => createTask(db, { owner_id: teammate.id }))
      expect(error.code).toBe(SqlState.insufficientPrivilege)
    })
  })

  test("deactivating a teammate cuts off access immediately", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      await actAs(db, teammate.authUserId)
      expect(await visibleRows(db, "organizations")).toBeGreaterThan(0)

      await resetRole(db)
      await db.query("update public.people set is_active = false where id = $1", [teammate.id])
      await actAs(db, teammate.authUserId)
      expect(await visibleRows(db, "organizations")).toBe(0)
    })
  })
})

describe("active teammates", () => {
  test("can add, read and edit rows in every team table", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const quarter = await quarterId(db)
      await actAs(db, me.authUserId)
      const ids = await createOneOfEverything(db, me.id, quarter)

      for (const table of TEAM_TABLES) {
        expect(await visibleRows(db, table), table).toBeGreaterThan(0)
      }
      for (const { table, apply } of edits(me.id)) {
        const row = await apply(db, ids[table])
        expect(row, table).toBeDefined()
        expect(row?.updated_by, table).toBe(me.id)
      }
    })
  })

  test("can read people, actors, stages, quarters, the activity log and the views", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      await actAs(db, teammate.authUserId)
      for (const relation of [
        "people",
        "actors",
        "org_stages",
        "quarters",
        "activity_log",
        "feedback",
        "usage_events",
        "help_requests",
        ...VIEWS,
      ]) {
        expect(await visibleRows(db, relation), relation).toBeGreaterThan(0)
      }
    })
  })

  test("can't change reference data or identity rows directly", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      await actAs(db, teammate.authUserId)
      const attempts = [
        "insert into public.org_stages (kind, stage, label, position, outcome) values ('investor', 'x', 'X', 99, 'open')",
        "update public.org_stages set label = 'X'",
        "update public.quarters set label = 'Q4'",
        "insert into public.actors (kind, display_name) values ('bot', 'Fake bot')",
        "update public.actors set display_name = 'X'",
        "insert into public.people (name, role, email, sort_order) values ('X', 'X', 'x@example.test', 1)",
        "delete from public.people",
      ]
      for (const attempt of attempts) {
        const error = await sqlError(db, attempt)
        expect(error.code, attempt).toBe(SqlState.insufficientPrivilege)
      }
    })
  })

  test("can't hard-delete organizations, tasks or other main records", async () => {
    await withTx(async (db) => {
      const { teammate, ids } = await populate(db)
      await actAs(db, teammate.authUserId)
      for (const table of [
        "organizations",
        "tasks",
        "hypotheses",
        "objectives",
        "key_results",
        "decisions",
        "candidates",
        "checklist_templates",
        "org_meetings",
        "debriefs",
        "team_meetings",
        "help_requests",
      ] as const) {
        const error = await sqlError(db, `delete from public.${table} where id = $1`, [ids[table]])
        expect(error.code, table).toBe(SqlState.insufficientPrivilege)
      }
    })
  })

  test("can delete availability blocks, crunch periods, attendees and checklist items", async () => {
    await withTx(async (db) => {
      const { teammate, ids } = await populate(db)
      await actAs(db, teammate.authUserId)
      for (const table of [
        "availability_blocks",
        "crunch_periods",
        "org_meeting_attendees",
        "checklist_items",
        "action_items",
      ] as const) {
        const result = await db.query(`delete from public.${table} where id = $1`, [ids[table]])
        expect(result.rowCount, table).toBe(1)
      }
    })
  })

  test("can delete an action item only until it has become a task", async () => {
    await withTx(async (db) => {
      const { teammate, ids } = await populate(db)
      await actAs(db, teammate.authUserId)
      const converted = await insert(db, "action_items", {
        team_meeting_id: ids.team_meetings,
        description: "Converted item",
        task_id: ids.tasks,
      })
      const result = await db.query("delete from public.action_items where id = $1", [converted.id])
      expect(result.rowCount).toBe(0)
    })
  })

  test("can edit profile fields but not email, login link, rotation order or active flag", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const other = await createPerson(db, { name: "Other Person" })
      await actAs(db, me.authUserId)

      const renamed = await update(db, "people", other.id, {
        name: "Renamed Person",
        role: "Ops",
        strengths: ["Achiever"],
        contact_preference: "Text first",
      })
      expect(renamed?.name).toBe("Renamed Person")

      for (const [column, value] of [
        ["email", "new-email@example.test"],
        ["auth_user_id", me.authUserId],
        ["is_active", false],
        ["sort_order", 1],
      ] as const) {
        const error = await sqlError(db, `update public.people set ${column} = $1 where id = $2`, [
          value,
          other.id,
        ])
        expect(error.code, column).toBe(SqlState.insufficientPrivilege)
        expect(error.message, column).toMatch(/permission denied/)
      }
    })
  })

  test("can ask for help only as themselves", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const other = await createPerson(db)
      await actAs(db, me.authUserId)

      const spoofed = await sqlError(db, () =>
        insert(db, "help_requests", { requester_id: other.id, message: "Spoofed" }),
      )
      expect(spoofed.code).toBe(SqlState.insufficientPrivilege)
      expect(spoofed.message).toMatch(/row-level security/)

      const own = await insert(db, "help_requests", {
        requester_id: me.id,
        message: "Need an intro",
      })
      expect(own.created_by).toBe(me.id)
    })
  })

  test("can send feedback and usage events only as themselves", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const other = await createPerson(db)
      await actAs(db, me.authUserId)

      const spoofedFeedback = await sqlError(db, () =>
        insert(db, "feedback", { person_id: other.id, page_path: "/", message: "Spoofed" }),
      )
      expect(spoofedFeedback.code).toBe(SqlState.insufficientPrivilege)
      const spoofedUsage = await sqlError(db, () =>
        insert(db, "usage_events", {
          person_id: other.id,
          kind: "page_view",
          section: "home",
          path: "/",
        }),
      )
      expect(spoofedUsage.code).toBe(SqlState.insufficientPrivilege)

      const feedback = await insert(db, "feedback", {
        person_id: me.id,
        page_path: "/tasks",
        message: "Works well",
      })
      await insert(db, "usage_events", {
        person_id: me.id,
        kind: "feature_use",
        section: "tasks",
        path: "/tasks",
        feature: "tasks.create",
      })

      // Triage only: the status can change, the message can't.
      const triaged = await update(db, "feedback", feedback.id, { status: "seen" })
      expect(triaged?.status).toBe("seen")
      const rewrite = await sqlError(db, () =>
        update(db, "feedback", feedback.id, { message: "Rewritten" }),
      )
      expect(rewrite.code).toBe(SqlState.insufficientPrivilege)
    })
  })

  test("can't see or touch app_settings and event_dedupe", async () => {
    await withTx(async (db) => {
      const { teammate } = await populate(db)
      await actAs(db, teammate.authUserId)
      expect(await visibleRows(db, "app_settings")).toBe("denied")
      expect(await visibleRows(db, "event_dedupe")).toBe("denied")
      for (const attempt of [
        "insert into public.app_settings (key, value) values ('automation_start_date', '\"2000-01-01\"')",
        "update public.app_settings set value = '1'",
        "insert into public.event_dedupe (event, entity_id) values ('x', gen_random_uuid())",
        "delete from public.event_dedupe",
      ]) {
        const error = await sqlError(db, attempt)
        expect(error.code, attempt).toBe(SqlState.insufficientPrivilege)
      }
    })
  })

  test("can read the activity log but never write, edit or delete entries", async () => {
    await withTx(async (db) => {
      const { teammate, ids } = await populate(db)
      await actAs(db, teammate.authUserId)
      expect(await visibleRows(db, "activity_log")).toBeGreaterThan(0)
      for (const attempt of [
        `insert into public.activity_log (actor_kind, action, entity_type, entity_id)
         values ('person', 'insert', 'tasks', '${ids.tasks}')`,
        "update public.activity_log set action = 'delete'",
        "delete from public.activity_log",
      ]) {
        const error = await sqlError(db, attempt)
        expect(error.code, attempt).toBe(SqlState.insufficientPrivilege)
      }
    })
  })

  test("can't run the scheduled checks; only the server key can", async () => {
    await withTx(async (db) => {
      const teammate = await createTeammate(db)
      await actAs(db, teammate.authUserId)
      const asTeammate = await sqlError(db, "select public.run_scheduled_checks()")
      expect(asTeammate.code).toBe(SqlState.insufficientPrivilege)
      const helperDirectly = await sqlError(db, "select app.run_scheduled_checks()")
      expect(helperDirectly.code).toBe(SqlState.insufficientPrivilege)

      await actAsAnon(db)
      const asAnon = await sqlError(db, "select public.run_scheduled_checks()")
      expect(asAnon.code).toBe(SqlState.insufficientPrivilege)

      await actAsService(db)
      const result = await scalar<Record<string, number>>(
        db,
        "select public.run_scheduled_checks()",
      )
      expect(Object.keys(result).sort()).toEqual([
        "debriefs_created",
        "events_queued",
        "meetings_held",
      ])
    })
  })
})
