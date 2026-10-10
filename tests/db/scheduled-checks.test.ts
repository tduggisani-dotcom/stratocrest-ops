import { afterAll, describe, expect, test } from "vitest"
import {
  closeDb,
  createOrg,
  createOrgMeeting,
  createPerson,
  createSession,
  createTask,
  dayFromToday,
  deactivateEveryone,
  find,
  insert,
  lastLogFor,
  one,
  pastSunday,
  rows,
  runScheduledChecks,
  sameMoment,
  scalar,
  setAutomationStartDate,
  sql,
  update,
  withTx,
  withoutTriggers,
  type Db,
  type Raw,
} from "./helpers"

/**
 * The scheduled checks (`app.run_scheduled_checks()`, pg_cron every 15 min;
 * docs/DATA_MODEL.md §5 "Scheduled jobs"). They run as postgres, so the actor
 * is "system". now() is fixed inside a test's transaction, so "time passing"
 * is simulated by moving rows into the past with triggers off.
 */

afterAll(closeDb)

/** Today's date until noon ET on a Sunday, otherwise the coming Sunday (computed independently). */
async function nextMeetingDate(db: Db): Promise<string> {
  return scalar<string>(
    db,
    `select (l::date + case
               when extract(isodow from l) = 7 then case when l::time < '12:00' then 0 else 7 end
               else 7 - extract(isodow from l)::int
             end)::text
       from (select now() at time zone 'America/New_York' as l) x`,
  )
}

async function teamMeetings(db: Db) {
  return rows<{ id: string; meeting_date: string; facilitator_id: string; status: string }>(
    db,
    "select id, meeting_date::text, facilitator_id, status from public.team_meetings order by meeting_date",
  )
}

async function debriefs(
  db: Db,
  column: "synthe6_session_id" | "team_meeting_id" | "org_meeting_id",
  id: string,
) {
  return rows<{ kind: string; due_date: string; facilitator_id: string | null; status: string }>(
    db,
    `select kind, due_date, facilitator_id, status from public.debriefs where ${column} = $1`,
    [id],
  )
}

async function dedupeRows(db: Db, event: string, ids: string[]) {
  return rows<{ entity_id: string; dedupe_key: string }>(
    db,
    `select entity_id, dedupe_key from public.event_dedupe
      where event = $1 and entity_id = any($2::uuid[]) order by created_at, dedupe_key`,
    [event, ids],
  )
}

describe("next Sunday meeting", () => {
  /** No meetings, the seeded team inactive, and three people of our own (the middle one inactive). */
  async function rotation(db: Db) {
    await db.query("delete from public.team_meetings")
    await deactivateEveryone(db)
    const first = await createPerson(db, { name: "First In Rotation", sortOrder: 901 })
    const away = await createPerson(db, { name: "Away", sortOrder: 902, isActive: false })
    const last = await createPerson(db, { name: "Last In Rotation", sortOrder: 903 })
    const target = await nextMeetingDate(db)
    const lastWeek = await scalar<string>(db, "select ($1::date - 7)::text", [target])
    const previous = (facilitatorId: string) =>
      insert(db, "team_meetings", { meeting_date: lastWeek, facilitator_id: facilitatorId })
    return { first, away, last, target, previous }
  }

  test("is created for the coming Sunday at 9:00 AM ET, by the system, with the next active person", async () => {
    await withTx(async (db) => {
      const { first, last, target, previous } = await rotation(db)
      await previous(first.id)

      await runScheduledChecks(db)

      const meeting = await one<{
        id: string
        starts_at: string
        facilitator_id: string
        status: string
        created_by: string | null
      }>(
        db,
        "select id, starts_at, facilitator_id, status, created_by from public.team_meetings where meeting_date = $1",
        [target],
      )
      // The person in between is inactive, so the rotation skips them.
      expect(meeting).toMatchObject({
        facilitator_id: last.id,
        status: "upcoming",
        created_by: null,
      })
      const nineEt = await scalar(db, "select app.et_moment($1::date, '09:00')", [target])
      expect(await sameMoment(db, meeting.starts_at, nineEt)).toBe(true)
      expect((await lastLogFor(db, meeting.id)).actor_kind).toBe("system")
    })
  })

  test("wraps around to the first active person after the last one", async () => {
    await withTx(async (db) => {
      const { first, last, target, previous } = await rotation(db)
      await previous(last.id)
      await runScheduledChecks(db)
      expect((await teamMeetings(db)).find((m) => m.meeting_date === target)?.facilitator_id).toBe(
        first.id,
      )
    })
  })

  test("continues after the previous facilitator even if they are now inactive", async () => {
    await withTx(async (db) => {
      const { away, last, target, previous } = await rotation(db)
      await previous(away.id)
      await runScheduledChecks(db)
      expect((await teamMeetings(db)).find((m) => m.meeting_date === target)?.facilitator_id).toBe(
        last.id,
      )
    })
  })

  test("starts with the first active person when there is no earlier meeting", async () => {
    await withTx(async (db) => {
      const { first, target } = await rotation(db)
      await runScheduledChecks(db)
      expect(await teamMeetings(db)).toEqual([
        expect.objectContaining({ meeting_date: target, facilitator_id: first.id }),
      ])
    })
  })

  test("is skipped while nobody is active", async () => {
    await withTx(async (db) => {
      await db.query("delete from public.team_meetings")
      await deactivateEveryone(db)
      await runScheduledChecks(db)
      expect(await teamMeetings(db)).toEqual([])
    })
  })

  test("running the checks again changes nothing", async () => {
    await withTx(async (db) => {
      const { away, target } = await rotation(db)
      // An existing meeting for that Sunday is kept as it is.
      await insert(db, "team_meetings", { meeting_date: target, facilitator_id: away.id })

      await runScheduledChecks(db)
      const before = await teamMeetings(db)
      const again = await runScheduledChecks(db)

      expect(again).toEqual({ meetings_held: 0, debriefs_created: 0, events_queued: 0 })
      expect(await teamMeetings(db)).toEqual(before)
      expect(before.find((m) => m.meeting_date === target)?.facilitator_id).toBe(away.id)
    })
  })
})

describe("held meetings", () => {
  test("a Sunday meeting counts as held two hours after it starts", async () => {
    await withTx(async (db) => {
      await db.query("delete from public.team_meetings")
      const person = await createPerson(db)
      const meeting = async (weeksAgo: number, values: { starts_at?: Raw; status?: "canceled" }) =>
        insert(db, "team_meetings", {
          meeting_date: await pastSunday(db, weeksAgo),
          facilitator_id: person.id,
          ...values,
        })
      const twoHoursAgo = await meeting(0, { starts_at: sql("now() - interval '2 hours'") })
      const stillGoing = await meeting(1, {
        starts_at: sql("now() - interval '1 hour 59 minutes'"),
      })
      const canceled = await meeting(2, { status: "canceled" })
      const lastMonth = await meeting(3, {})
      const future = await insert(db, "team_meetings", {
        meeting_date: "2030-07-07",
        facilitator_id: person.id,
      })

      const result = await runScheduledChecks(db)

      const status = async (id: string) => (await find(db, "team_meetings", id))?.status
      expect(await status(twoHoursAgo.id)).toBe("held")
      expect(await status(stillGoing.id)).toBe("upcoming")
      expect(await status(canceled.id)).toBe("canceled")
      expect(await status(lastMonth.id)).toBe("held")
      expect(await status(future.id)).toBe("upcoming")
      expect(result.meetings_held).toBeGreaterThanOrEqual(2)
    })
  })
})

describe("automatic debriefs", () => {
  test("Synthe6 sessions: from the automation start date, once ended, not for breaks; mentor coaching → mentor", async () => {
    await withTx(async (db) => {
      await setAutomationStartDate(db, "2000-06-01")
      const owner = await createPerson(db)
      const onStartDate = await createSession(db, { end_date: "2000-06-01", owner_id: owner.id })
      const beforeStart = await createSession(db, { end_date: "2000-05-31", owner_id: owner.id })
      const mentor = await createSession(db, {
        end_date: sql("app.today_et() - 1"),
        emphasis: "mentor_coaching",
        owner_id: owner.id,
      })
      const shareOut = await createSession(db, {
        end_date: sql("app.today_et() - 1"),
        emphasis: "okr_share_out",
      })
      const breakWeek = await createSession(db, {
        end_date: sql("app.today_et() - 3"),
        is_break: true,
      })
      const endsToday = await createSession(db, { end_date: sql("app.today_et()") })

      await runScheduledChecks(db)

      const today = await dayFromToday(db, 0)
      expect(await debriefs(db, "synthe6_session_id", onStartDate.id)).toEqual([
        { kind: "synthe6", due_date: "2000-06-02", facilitator_id: owner.id, status: "due" },
      ])
      expect(await debriefs(db, "synthe6_session_id", mentor.id)).toEqual([
        { kind: "mentor", due_date: today, facilitator_id: owner.id, status: "due" },
      ])
      expect(await debriefs(db, "synthe6_session_id", shareOut.id)).toEqual([
        { kind: "synthe6", due_date: today, facilitator_id: null, status: "due" },
      ])
      for (const none of [beforeStart, breakWeek, endsToday]) {
        expect(await debriefs(db, "synthe6_session_id", none.id), none.end_date).toEqual([])
      }
    })
  })

  test("Sunday meetings: once held, from the automation start date", async () => {
    await withTx(async (db) => {
      await db.query("delete from public.team_meetings")
      await setAutomationStartDate(db, await pastSunday(db, 2))
      const facilitator = await createPerson(db)
      const meeting = async (weeksAgo: number, status?: "canceled") =>
        insert(db, "team_meetings", {
          meeting_date: await pastSunday(db, weeksAgo),
          facilitator_id: facilitator.id,
          status,
        })
      const lastSunday = await meeting(0)
      const canceled = await meeting(1, "canceled")
      const onStartDate = await meeting(2)
      const beforeStart = await meeting(3)

      await runScheduledChecks(db)

      expect(await debriefs(db, "team_meeting_id", lastSunday.id)).toEqual([
        {
          kind: "team_meeting",
          due_date: lastSunday.meeting_date,
          facilitator_id: facilitator.id,
          status: "due",
        },
      ])
      expect(await debriefs(db, "team_meeting_id", onStartDate.id)).toHaveLength(1)
      expect((await find(db, "team_meetings", beforeStart.id))?.status).toBe("held")
      expect(await debriefs(db, "team_meeting_id", beforeStart.id)).toEqual([])
      expect(await debriefs(db, "team_meeting_id", canceled.id)).toEqual([])
    })
  })

  test("without an automation start date, only org meetings get debriefs", async () => {
    await withTx(async (db) => {
      await db.query("delete from public.team_meetings")
      await setAutomationStartDate(db, null)
      const owner = await createPerson(db)
      const session = await createSession(db, { end_date: "2000-03-01", owner_id: owner.id })
      const teamMeeting = await insert(db, "team_meetings", {
        meeting_date: await pastSunday(db, 0),
        facilitator_id: owner.id,
      })
      const org = await createOrg(db, { owner_id: owner.id })
      const orgMeeting = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() + interval '1 day'"),
      })
      await withoutTriggers(db, () =>
        db.query(
          "update public.org_meetings set starts_at = now() - interval '1 hour' where id = $1",
          [orgMeeting.id],
        ),
      )

      await runScheduledChecks(db)

      expect(await debriefs(db, "synthe6_session_id", session.id)).toEqual([])
      expect((await find(db, "team_meetings", teamMeeting.id))?.status).toBe("held")
      expect(await debriefs(db, "team_meeting_id", teamMeeting.id)).toEqual([])
      expect(await debriefs(db, "org_meeting_id", orgMeeting.id)).toHaveLength(1)
    })
  })

  test("org meetings logged ahead of time get their debrief and count as contact once they happen", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const today = await dayFromToday(db, 0)
      const org = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      const recent = await createOrg(db, { owner_id: owner.id, last_contact_date: today })
      const ahead = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() + interval '1 day'"),
      })
      const aheadRecent = await createOrgMeeting(db, {
        organization_id: recent.id,
        starts_at: sql("now() + interval '1 day'"),
      })
      // Time passes: both meetings are now two days ago.
      await withoutTriggers(db, () =>
        db.query(
          "update public.org_meetings set starts_at = app.et_moment(app.today_et() - 2, '10:00') where id = any($1::uuid[])",
          [[ahead.id, aheadRecent.id]],
        ),
      )
      expect(await debriefs(db, "org_meeting_id", ahead.id)).toEqual([])

      await runScheduledChecks(db)

      const twoDaysAgo = await dayFromToday(db, -2)
      expect(await debriefs(db, "org_meeting_id", ahead.id)).toEqual([
        { kind: "customer", due_date: twoDaysAgo, facilitator_id: owner.id, status: "due" },
      ])
      expect((await find(db, "organizations", org.id))?.last_contact_date).toBe(twoDaysAgo)
      // Never moved backwards.
      expect((await find(db, "organizations", recent.id))?.last_contact_date).toBe(today)
    })
  })
})

describe("outbound events (event_dedupe)", () => {
  test("task.overdue is queued once per task and due date, and again when the due date moves", async () => {
    await withTx(async (db) => {
      await runScheduledChecks(db) // Flush whatever is already overdue or due.
      const owner = await createPerson(db)
      const overdue = await createTask(db, {
        owner_id: owner.id,
        due_date: sql("app.today_et() - 3"),
      })
      const quiet = [
        await createTask(db, { owner_id: owner.id, due_date: sql("app.today_et()") }),
        await createTask(db, {
          owner_id: owner.id,
          due_date: sql("app.today_et() - 3"),
          status: "done",
        }),
        await createTask(db, {
          owner_id: owner.id,
          due_date: sql("app.today_et() - 3"),
          archived_at: sql("now()"),
        }),
      ]
      const ids = [overdue.id, ...quiet.map((t) => t.id)]

      expect((await runScheduledChecks(db)).events_queued).toBe(1)
      expect(await dedupeRows(db, "task.overdue", ids)).toEqual([
        { entity_id: overdue.id, dedupe_key: await dayFromToday(db, -3) },
      ])
      expect((await runScheduledChecks(db)).events_queued).toBe(0)

      await update(db, "tasks", overdue.id, { due_date: sql("app.today_et() - 1") })
      expect((await runScheduledChecks(db)).events_queued).toBe(1)
      expect((await dedupeRows(db, "task.overdue", ids)).map((r) => r.dedupe_key).sort()).toEqual([
        await dayFromToday(db, -3),
        await dayFromToday(db, -1),
      ])

      await update(db, "tasks", overdue.id, { due_date: sql("app.today_et() + 5") })
      expect((await runScheduledChecks(db)).events_queued).toBe(0)
    })
  })

  test("debrief.due is queued once per debrief, when it comes due", async () => {
    await withTx(async (db) => {
      await runScheduledChecks(db)
      const person = await createPerson(db)
      const debrief = async (meetingDate: string, values: { due_date: Raw; status?: "done" }) => {
        const meeting = await insert(db, "team_meetings", {
          meeting_date: meetingDate,
          facilitator_id: person.id,
          status: "canceled",
        })
        return insert(db, "debriefs", {
          kind: "team_meeting",
          team_meeting_id: meeting.id,
          ...values,
        })
      }
      const dueToday = await debrief("2030-07-07", { due_date: sql("app.today_et()") })
      const dueTomorrow = await debrief("2030-07-14", { due_date: sql("app.today_et() + 1") })
      const done = await debrief("2030-07-21", {
        due_date: sql("app.today_et() - 1"),
        status: "done",
      })
      const ids = [dueToday.id, dueTomorrow.id, done.id]

      expect((await runScheduledChecks(db)).events_queued).toBe(1)
      expect(await dedupeRows(db, "debrief.due", ids)).toEqual([
        { entity_id: dueToday.id, dedupe_key: "" },
      ])
      expect((await runScheduledChecks(db)).events_queued).toBe(0)

      await update(db, "debriefs", dueTomorrow.id, { due_date: sql("app.today_et()") })
      expect((await runScheduledChecks(db)).events_queued).toBe(1)
      expect(await dedupeRows(db, "debrief.due", ids)).toHaveLength(2)
    })
  })
})
