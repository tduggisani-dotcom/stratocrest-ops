import { afterAll, describe, expect, test } from "vitest"
import {
  actAs,
  actAsService,
  closeDb,
  createBot,
  createOrg,
  createOrgMeeting,
  createPerson,
  createTask,
  createTeammate,
  deactivateEveryone,
  insert,
  lastLogFor,
  one,
  rows,
  sql,
  undo,
  update,
  withTx,
  withoutTriggers,
  type Db,
  type ViewRow,
} from "./helpers"

/**
 * Read models shared by the UI and the bot API (docs/DATA_MODEL.md §4):
 * org_overview, person_workload and wins_feed.
 */

afterAll(closeDb)

type Overview = ViewRow<"org_overview">
type Workload = ViewRow<"person_workload">
type Win = ViewRow<"wins_feed">

async function overview(db: Db, orgId: string): Promise<Overview> {
  return one<Overview>(db, "select * from public.org_overview where id = $1", [orgId])
}

async function workload(db: Db): Promise<Workload[]> {
  return rows<Workload>(db, "select * from public.person_workload order by sort_order, name")
}

async function winsFor(db: Db, entityId: string): Promise<Win[]> {
  return rows<Win>(db, "select * from public.wins_feed where entity_id = $1 order by id", [
    entityId,
  ])
}

describe("org_overview", () => {
  test("shows the latest past meeting and the next upcoming one", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db, { name: "Owner Person" })
      const org = await createOrg(db, { owner_id: owner.id })
      const meeting = (when: string, values: { rating?: number; summary?: string } = {}) =>
        createOrgMeeting(db, {
          organization_id: org.id,
          starts_at: sql(`now() ${when}`),
          ...values,
        })
      await meeting("- interval '10 days'", { rating: 2, summary: "Too early for them" })
      const latest = await meeting("- interval '2 days'", {
        rating: 5,
        summary: "Asked for the deck",
      })
      const next = await meeting("+ interval '1 day'")
      await meeting("+ interval '5 days'")

      expect(await overview(db, org.id)).toMatchObject({
        owner_name: "Owner Person",
        stage: "identified",
        stage_label: "Identified",
        stage_position: 1,
        stage_outcome: "open",
        latest_meeting_id: latest.id,
        latest_rating: 5,
        latest_summary: "Asked for the deck",
        next_meeting_id: next.id,
      })

      const quiet = await createOrg(db, { owner_id: owner.id })
      expect(await overview(db, quiet.id)).toMatchObject({
        latest_meeting_id: null,
        latest_rating: null,
        next_meeting_id: null,
        next_meeting_at: null,
      })
    })
  })

  test("is stale from exactly 14 days without contact, only in open stages", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const org = (values: { kind?: "investor" | "customer"; stage?: string; daysAgo: number }) =>
        createOrg(db, {
          owner_id: owner.id,
          kind: values.kind ?? "investor",
          stage: values.stage,
          last_contact_date: sql(`app.today_et() - ${values.daysAgo}`),
        })

      const cases = [
        { values: { daysAgo: 13 }, days: 13, stale: false },
        { values: { daysAgo: 14 }, days: 14, stale: true },
        { values: { daysAgo: 30, stage: "diligence" }, days: 30, stale: true },
        { values: { daysAgo: 30, kind: "customer", stage: "pilot_active" }, days: 30, stale: true },
        { values: { daysAgo: 30, stage: "committed" }, days: 30, stale: false },
        { values: { daysAgo: 30, stage: "passed" }, days: 30, stale: false },
        { values: { daysAgo: 30, kind: "customer", stage: "converted" }, days: 30, stale: false },
        { values: { daysAgo: 30, kind: "customer", stage: "lost" }, days: 30, stale: false },
      ] as const
      for (const { values, days, stale } of cases) {
        const row = await overview(db, (await org(values)).id)
        expect(
          { days: row.days_since_contact, stale: row.is_stale },
          JSON.stringify(values),
        ).toEqual({
          days,
          stale,
        })
      }
    })
  })

  test("counts from the day it was added when there has been no contact", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const fresh = await createOrg(db, { owner_id: owner.id })
      expect(await overview(db, fresh.id)).toMatchObject({ days_since_contact: 0, is_stale: false })

      const old = await createOrg(db, { owner_id: owner.id })
      await withoutTriggers(db, () =>
        db.query(
          "update public.organizations set created_at = app.et_moment(app.today_et() - 20, '12:00') where id = $1",
          [old.id],
        ),
      )
      expect(await overview(db, old.id)).toMatchObject({ days_since_contact: 20, is_stale: true })
    })
  })

  test("flags an overdue follow-up (next step date before today) in open stages only", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const org = (daysFromToday: number, stage?: string) =>
        createOrg(db, {
          owner_id: owner.id,
          stage,
          next_step_date: sql(`app.today_et() + ${daysFromToday}`),
        })
      const cases = [
        { org: await org(-1), overdue: true },
        { org: await org(0), overdue: false },
        { org: await org(3), overdue: false },
        { org: await org(-5, "committed"), overdue: false },
        { org: await org(-5, "passed"), overdue: false },
      ]
      for (const { org: row, overdue } of cases) {
        expect((await overview(db, row.id)).follow_up_overdue, row.next_step_date).toBe(overdue)
      }
    })
  })
})

describe("person_workload", () => {
  /** `n` open tasks for a person (as postgres). */
  async function giveOpenTasks(db: Db, personId: string, n: number) {
    await db.query(
      `insert into public.tasks (title, next_action, owner_id, due_date)
       select 'Load ' || i, 'Start', $1, app.today_et() + 7 from generate_series(1, $2::int) i`,
      [personId, n],
    )
  }

  async function team(db: Db, loads: number[]) {
    await deactivateEveryone(db)
    const people = []
    for (const [i, load] of loads.entries()) {
      const person = await createPerson(db, { name: `Load ${load} #${i}`, sortOrder: 900 + i })
      await giveOpenTasks(db, person.id, load)
      people.push(person)
    }
    return people
  }

  test("counts open and overdue tasks, overdue follow-ups, meetings this week and debriefs due", async () => {
    await withTx(async (db) => {
      await deactivateEveryone(db)
      const me = await createTeammate(db, { sortOrder: 900 })
      const colleague = await createPerson(db, { sortOrder: 901 })
      const formerTeammate = await createPerson(db, { sortOrder: 902, isActive: false })
      const p = me.id

      // Tasks: 2 open (1 overdue); done and archived ones don't count.
      await createTask(db, { owner_id: p, due_date: sql("app.today_et() - 1") })
      await createTask(db, { owner_id: p, due_date: sql("app.today_et()"), status: "blocked" })
      await createTask(db, { owner_id: p, due_date: sql("app.today_et() - 1"), status: "done" })
      await createTask(db, {
        owner_id: p,
        due_date: sql("app.today_et() - 1"),
        archived_at: sql("now()"),
      })

      // Follow-ups: 1 overdue in an open stage.
      await createOrg(db, { owner_id: p, next_step_date: sql("app.today_et() - 2") })
      await createOrg(db, { owner_id: p, next_step_date: sql("app.today_et()") })
      await createOrg(db, {
        owner_id: p,
        stage: "committed",
        next_step_date: sql("app.today_et() - 2"),
      })
      await createOrg(db, {
        owner_id: p,
        next_step_date: sql("app.today_et() - 2"),
        archived_at: sql("now()"),
      })

      // Meetings: attending 1 in the next 7 days (on a colleague's org, so no debrief for me).
      const theirs = await createOrg(db, { owner_id: colleague.id })
      for (const when of ["+ interval '1 day'", "+ interval '8 days'", "- interval '1 day'"]) {
        const meeting = await createOrgMeeting(db, {
          organization_id: theirs.id,
          starts_at: sql(`now() ${when}`),
        })
        await insert(db, "org_meeting_attendees", { org_meeting_id: meeting.id, person_id: p })
      }

      // Debriefs: 1 due today; future and done ones don't count.
      const debrief = async (date: string, due: string, status: "due" | "done" = "due") => {
        const meeting = await insert(db, "team_meetings", { meeting_date: date, facilitator_id: p })
        await insert(db, "debriefs", {
          kind: "team_meeting",
          team_meeting_id: meeting.id,
          due_date: sql(due),
          facilitator_id: p,
          status,
        })
      }
      await debrief("2030-07-07", "app.today_et()")
      await debrief("2030-07-14", "app.today_et() + 1")
      await debrief("2030-07-21", "app.today_et() - 3", "done")

      // Read it as a teammate would (the view runs with the caller's rights).
      await actAs(db, me.authUserId)
      const result = await workload(db)
      expect(result.map((r) => r.person_id)).toEqual([me.id, colleague.id])
      expect(result.map((r) => r.person_id)).not.toContain(formerTeammate.id)
      expect(result[0]).toMatchObject({
        open_tasks: 2,
        overdue_tasks: 1,
        overdue_follow_ups: 1,
        meetings_next_7_days: 1,
        debriefs_due: 1,
        total_load: 5,
      })
      // The colleague owns the org with yesterday's meeting, so its debrief is theirs.
      expect(result[1]).toMatchObject({ open_tasks: 0, debriefs_due: 1, total_load: 1 })
      expect(result[0].team_average).toBe(3)
    })
  })

  test("flags a person at ≥ 1.5× the team average and at least 3 above it", async () => {
    await withTx(async (db) => {
      const people = await team(db, [0, 0, 0, 8])
      const result = await workload(db)
      expect(result.map((r) => r.team_average)).toEqual([2, 2, 2, 2])
      expect(result.map((r) => [r.person_id, r.is_overloaded])).toEqual(
        people.map((p, i) => [p.id, i === 3]),
      )
    })
  })

  test("flags exactly at the boundary (average + 3 and ≥ 1.5×)", async () => {
    await withTx(async (db) => {
      await team(db, [3, 3, 3, 7]) // average 4: 7 = 4 + 3 and 7 ≥ 6
      expect((await workload(db)).map((r) => r.is_overloaded)).toEqual([false, false, false, true])
    })
  })

  test("doesn't flag ≥ 1.5× the average when it's less than 3 above it", async () => {
    await withTx(async (db) => {
      await team(db, [1, 1, 1, 3]) // average 1.5: 3 ≥ 2.25 but 3 < 4.5
      expect((await workload(db)).map((r) => r.is_overloaded)).toEqual([false, false, false, false])
    })
  })

  test("doesn't flag 3 above the average when it's less than 1.5×", async () => {
    await withTx(async (db) => {
      await team(db, [10, 10, 10, 14]) // average 11: 14 = 11 + 3 but 14 < 16.5
      const result = await workload(db)
      expect(result.map((r) => r.team_average)).toEqual([11, 11, 11, 11])
      expect(result.map((r) => r.is_overloaded)).toEqual([false, false, false, false])
    })
  })

  test("nobody is flagged when nobody has anything", async () => {
    await withTx(async (db) => {
      await team(db, [0, 0, 0])
      expect((await workload(db)).map((r) => r.is_overloaded)).toEqual([false, false, false])
    })
  })
})

describe("wins_feed", () => {
  test("a task moved to done is a win; edits while done and reopening are not", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { status: "in_progress" })
      await update(db, "tasks", task.id, { status: "done" })
      await update(db, "tasks", task.id, { notes: "Sent the follow-up too" })
      await update(db, "tasks", task.id, { status: "to_do" })

      const wins = await winsFor(db, task.id)
      expect(wins.map((w) => [w.win_kind, w.actor_kind, w.actor_id])).toEqual([
        ["task_done", "person", me.id],
      ])
      expect(wins[0].after).toMatchObject({ status: "done" })
    })
  })

  test("the bot finishing a task is a win attributed to the bot", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const task = await createTask(db, { owner_id: owner.id })
      const bot = await createBot(db)
      await actAsService(db, bot)
      await update(db, "tasks", task.id, { status: "done" })
      expect((await winsFor(db, task.id)).map((w) => [w.win_kind, w.actor_kind])).toEqual([
        ["task_done", "bot"],
      ])
    })
  })

  test("a stage advance is a win; moving back or to a lost stage is not", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const investor = await createOrg(db, { owner_id: me.id, kind: "investor" })
      const customer = await createOrg(db, { owner_id: me.id, kind: "customer" })
      const moves = [
        [investor.id, "contacted"], // win
        [investor.id, "diligence"], // win (skips a stage)
        [investor.id, "meeting"], // back
        [investor.id, "committed"], // win (won)
        [investor.id, "passed"], // lost
        [customer.id, "lost"], // lost
      ] as const
      for (const [id, stage] of moves) await update(db, "organizations", id, { stage })

      const stagesWon = async (id: string) =>
        (await winsFor(db, id)).map((w) => [w.win_kind, (w.after as { stage: string }).stage])
      expect(await stagesWon(investor.id)).toEqual([
        ["stage_advanced", "contacted"],
        ["stage_advanced", "diligence"],
        ["stage_advanced", "committed"],
      ])
      expect(await stagesWon(customer.id)).toEqual([])
    })
  })

  test("a meeting rated 4 or more is a win when the rating crosses 4", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id })
      const past = sql("now() - interval '1 day'")

      const ratedFour = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: past,
        rating: 4,
      })
      await update(db, "org_meetings", ratedFour.id, { rating: 5 }) // already strong: no new win
      const ratedThree = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: past,
        rating: 3,
      })
      const unrated = await createOrgMeeting(db, { organization_id: org.id, starts_at: past })
      await update(db, "org_meetings", unrated.id, { rating: 4 }) // crosses: win

      const kinds = async (id: string) => (await winsFor(db, id)).map((w) => w.win_kind)
      expect(await kinds(ratedFour.id)).toEqual(["strong_meeting"])
      expect(await kinds(ratedThree.id)).toEqual([])
      expect(await kinds(unrated.id)).toEqual(["strong_meeting"])

      await update(db, "org_meetings", ratedThree.id, { rating: 4 })
      expect(await kinds(ratedThree.id)).toEqual(["strong_meeting"])
    })
  })

  test("undo entries are never wins", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      const org = await createOrg(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { status: "done" })
      await update(db, "tasks", task.id, { status: "to_do" })
      await update(db, "organizations", org.id, { stage: "contacted" })
      await update(db, "organizations", org.id, { stage: "identified" })

      // Undoing the "reopen" and the "move back" re-does a done task and a stage advance.
      const reopen = await lastLogFor(db, task.id)
      const moveBack = await lastLogFor(db, org.id)
      await undo(db, reopen.id)
      await undo(db, moveBack.id)

      // Only the original moves count.
      const taskWins = await winsFor(db, task.id)
      const orgWins = await winsFor(db, org.id)
      expect(taskWins).toHaveLength(1)
      expect(orgWins).toHaveLength(1)
      expect(taskWins[0].id).toBeLessThan(reopen.id)
      expect(orgWins[0].id).toBeLessThan(moveBack.id)
    })
  })
})
