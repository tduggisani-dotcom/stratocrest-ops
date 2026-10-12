import { afterAll, describe, expect, test } from "vitest"
import {
  SqlState,
  actAs,
  actAsAnon,
  actAsService,
  closeDb,
  createBot,
  createOrg,
  createOrgMeeting,
  createTask,
  createTeammate,
  dayFromToday,
  find,
  insert,
  logFor,
  resetRole,
  rows,
  scalar,
  sql,
  sqlError,
  undo,
  update,
  withTx,
  type Db,
} from "./helpers"
import type { Database } from "@/types/database"

/**
 * Logging and editing an org meeting in one step (spec §6.2; migration
 * 20261012000200): public.log_org_meeting and public.update_org_meeting write
 * the meeting, who went from our side and the org's new next step as ONE
 * change. It's atomic, runs under RLS, opens the debrief for a meeting that
 * has happened, and undo_activity reverses it as a whole.
 */

afterAll(closeDb)

type Fns = Database["public"]["Functions"]
type LogArgs = { [K in keyof Fns["log_org_meeting"]["Args"]]?: unknown }
type UpdateArgs = { [K in keyof Fns["update_org_meeting"]["Args"]]?: unknown }

/** A SQL expression passed as an argument as is (e.g. a time relative to now()). */
type Expr = { expr: string }
function expr(sqlText: string): Expr {
  return { expr: sqlText }
}
function isExpr(value: unknown): value is Expr {
  return typeof value === "object" && value !== null && "expr" in value
}

/** `select public.<fn>(p_a => $1, …)` with named arguments, as PostgREST calls it. */
async function rpc(db: Db, fn: string, args: Record<string, unknown>): Promise<string> {
  const params: unknown[] = []
  const named: string[] = []
  for (const [name, value] of Object.entries(args)) {
    if (value === undefined) continue
    if (isExpr(value)) {
      named.push(`${name} => ${value.expr}`)
    } else {
      params.push(value)
      named.push(`${name} => $${params.length}`)
    }
  }
  return scalar<string>(db, `select public.${fn}(${named.join(", ")})`, params)
}

function logMeeting(db: Db, args: LogArgs & { p_organization_id: string }): Promise<string> {
  return rpc(db, "log_org_meeting", { p_starts_at: expr("now() - interval '1 hour'"), ...args })
}

function updateMeeting(db: Db, args: UpdateArgs & { p_meeting_id: string }): Promise<string> {
  return rpc(db, "update_org_meeting", { p_starts_at: expr("now() - interval '1 hour'"), ...args })
}

async function attendeesOf(db: Db, meetingId: string): Promise<string[]> {
  const result = await rows<{ person_id: string }>(
    db,
    "select person_id from public.org_meeting_attendees where org_meeting_id = $1 order by person_id",
    [meetingId],
  )
  return result.map((r) => r.person_id)
}

async function meetingsOf(db: Db, orgId: string): Promise<number> {
  return scalar<number>(
    db,
    "select count(*)::int from public.org_meetings where organization_id = $1",
    [orgId],
  )
}

async function debriefOf(db: Db, meetingId: string) {
  return rows<{ kind: string; due_date: string; facilitator_id: string | null; status: string }>(
    db,
    "select kind, due_date, facilitator_id, status from public.debriefs where org_meeting_id = $1",
    [meetingId],
  )
}

/** Two teammates and an investor owned by the first, with the first signed in. */
async function setup(db: Db) {
  const me = await createTeammate(db)
  const mate = await createTeammate(db)
  await actAs(db, me.authUserId)
  const org = await createOrg(db, { owner_id: me.id, next_step: "Send the one-pager" })
  return { me, mate, org }
}

describe("log_org_meeting", () => {
  test("saves the meeting, who went and the org's new next step together", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const nextDate = await dayFromToday(db, 5)

      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id, mate.id, me.id],
        p_external_attendees: "Jane Doe (partner)",
        p_rating: 4,
        p_summary: "Keen on the pilot data",
        p_notes: "Walked through the helmet demo.",
        p_concerns_raised: "Battery life",
        p_materials_requested: "Deck and test results",
        p_follow_up_owner_id: mate.id,
        p_follow_up_date: nextDate,
        p_next_step: "  Send the test results  ",
        p_next_step_date: nextDate,
      })

      const meeting = await find(db, "org_meetings", id)
      expect(meeting).toMatchObject({
        organization_id: org.id,
        external_attendees: "Jane Doe (partner)",
        rating: 4,
        summary: "Keen on the pilot data",
        concerns_raised: "Battery life",
        materials_requested: "Deck and test results",
        follow_up_owner_id: mate.id,
        follow_up_date: nextDate,
        created_by: me.id,
      })
      expect(await attendeesOf(db, id)).toEqual([me.id, mate.id].sort())
      expect(await find(db, "organizations", org.id)).toMatchObject({
        next_step: "Send the test results",
        next_step_date: nextDate,
      })
    })
  })

  test("leaves the org alone when no next step is given, or it's unchanged", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      await logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] })
      await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id],
        p_next_step: org.next_step,
        p_next_step_date: org.next_step_date,
      })
      const orgLog = (await logFor(db, org.id)).map((l) => l.action)
      expect(orgLog).toEqual(["insert"])
    })
  })

  test("is atomic: when any part fails, nothing is saved", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)

      // An attendee who isn't a person: the meeting itself is rolled back too.
      const badAttendee = await sqlError(db, () =>
        logMeeting(db, {
          p_organization_id: org.id,
          p_attendee_ids: [me.id, "00000000-0000-4000-8000-000000000000"],
        }),
      )
      expect(badAttendee.code).toBe(SqlState.foreignKeyViolation)

      // A blank next step: the meeting and its attendees are rolled back.
      const blankStep = await sqlError(db, () =>
        logMeeting(db, {
          p_organization_id: org.id,
          p_attendee_ids: [me.id],
          p_next_step: "   ",
          p_next_step_date: org.next_step_date,
        }),
      )
      expect(blankStep.code).toBe(SqlState.checkViolation)

      // Follow-up owner without a date (the table's both-or-neither CHECK).
      const halfFollowUp = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_follow_up_owner_id: me.id }),
      )
      expect(halfFollowUp.code).toBe(SqlState.checkViolation)

      expect(await meetingsOf(db, org.id)).toBe(0)
      expect(
        await scalar<number>(
          db,
          `select count(*)::int from public.activity_log
            where entity_type = 'org_meetings' and after ->> 'organization_id' = $1`,
          [org.id],
        ),
      ).toBe(0)
      expect(await find(db, "organizations", org.id)).toMatchObject({ next_step: org.next_step })
    })
  })

  test("checks what the table can't: rating only after it happens, next step with a date, live org", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)

      const futureRating = await sqlError(db, () =>
        logMeeting(db, {
          p_organization_id: org.id,
          p_starts_at: expr("now() + interval '1 day'"),
          p_rating: 5,
        }),
      )
      expect(futureRating.code).toBe(SqlState.checkViolation)
      expect(futureRating.message).toBe("Rate the meeting after it happens.")

      const outOfRange = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_rating: 6 }),
      )
      expect(outOfRange.code).toBe(SqlState.checkViolation)

      const stepWithoutDate = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_next_step: "Call back" }),
      )
      expect(stepWithoutDate.message).toBe("A new next step needs both the step and its date.")

      const tooLong = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_summary: "x".repeat(201) }),
      )
      expect(tooLong.code).toBe(SqlState.checkViolation)

      const unknownOrg = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: "00000000-0000-4000-8000-000000000000" }),
      )
      expect(unknownOrg.code).toBe(SqlState.foreignKeyViolation)

      await update(db, "organizations", org.id, { archived_at: sql("now()") })
      const archived = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] }),
      )
      expect(archived.message).toBe(
        "This investor is archived. Restore it to log or edit its meetings.",
      )
      expect(await meetingsOf(db, org.id)).toBe(0)
    })
  })

  test("a future meeting may be logged without a rating (scheduled)", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() + interval '3 days'"),
        p_attendee_ids: [me.id],
        p_summary: "Intro call",
      })
      expect(await find(db, "org_meetings", id)).toMatchObject({
        rating: null,
        summary: "Intro call",
      })
    })
  })

  test("opens the debrief for a meeting that has happened, not for a future one", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const past = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() - interval '2 hours'"),
        p_attendee_ids: [mate.id],
      })
      // Due on the meeting day, but never before the day it was opened: today.
      expect(await debriefOf(db, past)).toEqual([
        {
          kind: "investor",
          due_date: await dayFromToday(db, 0),
          facilitator_id: me.id,
          status: "due",
        },
      ])

      const future = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() + interval '2 hours'"),
        p_attendee_ids: [mate.id],
      })
      expect(await debriefOf(db, future)).toEqual([])
    })
  })

  test("runs as the caller: signed-out visitors and inactive people can't log", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)

      await actAsAnon(db)
      const anon = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] }),
      )
      expect(anon.code).toBe(SqlState.insufficientPrivilege)

      await resetRole(db)
      const former = await createTeammate(db, { isActive: false })
      await actAs(db, former.authUserId)
      const inactive = await sqlError(db, () =>
        logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] }),
      )
      // RLS hides the org from them, so it "doesn't exist".
      expect(inactive.code).toBe(SqlState.foreignKeyViolation)

      await actAs(db, me.authUserId)
      expect(await meetingsOf(db, org.id)).toBe(0)
    })
  })

  test("the bot can log through the server key, and is the author", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      await resetRole(db)
      const bot = await createBot(db)
      await actAsService(db, bot)
      const id = await logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] })
      expect((await find(db, "org_meetings", id))?.created_by).toBe(bot)
    })
  })

  test("undo on the logged change removes the meeting, who went, its debrief and the next-step change", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id, mate.id],
        p_rating: 3,
        p_summary: "Polite, not urgent",
        p_next_step: "Send the case study",
        p_next_step_date: await dayFromToday(db, 3),
      })
      expect(await debriefOf(db, id)).toHaveLength(1)
      const logged = (await logFor(db, id)).find((l) => l.action === "insert")!

      await undo(db, logged.id)

      expect(await find(db, "org_meetings", id)).toBeUndefined()
      expect(await attendeesOf(db, id)).toEqual([])
      expect(await debriefOf(db, id)).toEqual([])
      expect(await find(db, "organizations", org.id)).toMatchObject({
        next_step: org.next_step,
        next_step_date: org.next_step_date,
      })
    })
  })

  test("undo is refused once the debrief has been started or a task points at the meeting", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)

      const started = await logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] })
      await db.query(
        "update public.debriefs set planned = 'Ask about the pilot' where org_meeting_id = $1",
        [started],
      )
      const startedLog = (await logFor(db, started)).find((l) => l.action === "insert")!
      const changed = await sqlError(db, () => undo(db, startedLog.id))
      expect(changed.code).toBe(SqlState.serializationFailure)

      const followedUp = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id],
      })
      await createTask(db, { owner_id: me.id, org_meeting_id: followedUp })
      const followedUpLog = (await logFor(db, followedUp)).find((l) => l.action === "insert")!
      const pointedAt = await sqlError(db, () => undo(db, followedUpLog.id))
      expect(pointedAt.code).toBe(SqlState.foreignKeyViolation)

      // Nothing was removed by the refused undos.
      expect(await meetingsOf(db, org.id)).toBe(2)
      expect(await debriefOf(db, started)).toHaveLength(1)
      expect(await debriefOf(db, followedUp)).toHaveLength(1)
    })
  })
})

describe("the debrief of a meeting logged after the fact", () => {
  test("is due today, not overdue from the day it happened", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const meeting = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() - interval '3 days'"),
        p_attendee_ids: [mate.id],
      })
      expect(await debriefOf(db, meeting)).toEqual([
        {
          kind: "investor",
          due_date: await dayFromToday(db, 0),
          facilitator_id: me.id,
          status: "due",
        },
      ])
    })
  })

  test("stays due today when the meeting's time is corrected", async () => {
    await withTx(async (db) => {
      const { mate, org } = await setup(db)
      const meeting = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() - interval '3 days'"),
        p_attendee_ids: [mate.id],
      })
      await updateMeeting(db, {
        p_meeting_id: meeting,
        p_starts_at: expr("now() - interval '3 days' - interval '1 hour'"),
        p_attendee_ids: [mate.id],
      })
      const [debrief] = await debriefOf(db, meeting)
      expect(debrief?.due_date).toBe(await dayFromToday(db, 0))
    })
  })

  test("is never moved before the day it was opened", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const meeting = await logMeeting(db, {
        p_organization_id: org.id,
        p_starts_at: expr("now() - interval '1 hour'"),
        p_attendee_ids: [mate.id],
      })
      // A debrief opened 5 days ago (created_at is trigger-protected, so set it
      // as the owner with triggers off).
      await resetRole(db)
      await db.query("set local session_replication_role = replica")
      await db.query(
        `update public.debriefs set created_at = now() - interval '5 days',
           due_date = app.today_et() - 5 where org_meeting_id = $1`,
        [meeting],
      )
      await db.query("set local session_replication_role = origin")
      await actAs(db, me.authUserId)

      await db.query(
        "update public.debriefs set due_date = app.today_et() - 7 where org_meeting_id = $1",
        [meeting],
      )
      const [debrief] = await debriefOf(db, meeting)
      expect(debrief?.due_date).toBe(await dayFromToday(db, -5))
    })
  })
})

describe("update_org_meeting", () => {
  test("replaces the fields and who went, and can move the next step", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      await resetRole(db)
      const third = await createTeammate(db)
      await actAs(db, me.authUserId)
      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id, mate.id],
        p_rating: 2,
        p_summary: "Rough",
        p_notes: "First notes",
        p_follow_up_owner_id: me.id,
        p_follow_up_date: await dayFromToday(db, 2),
      })
      const date = await dayFromToday(db, 9)

      await updateMeeting(db, {
        p_meeting_id: id,
        p_attendee_ids: [mate.id, third.id],
        p_rating: 4,
        p_summary: "Better than it felt",
        p_next_step: "Book the site visit",
        p_next_step_date: date,
      })

      expect(await find(db, "org_meetings", id)).toMatchObject({
        rating: 4,
        summary: "Better than it felt",
        notes: null,
        follow_up_owner_id: null,
        follow_up_date: null,
        updated_by: me.id,
      })
      expect(await attendeesOf(db, id)).toEqual([mate.id, third.id].sort())
      expect(await find(db, "organizations", org.id)).toMatchObject({
        next_step: "Book the site visit",
        next_step_date: date,
      })
    })
  })

  test("null attendees leave who went as it is", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id, mate.id],
      })
      await updateMeeting(db, { p_meeting_id: id, p_summary: "Edited" })
      expect(await attendeesOf(db, id)).toEqual([me.id, mate.id].sort())
    })
  })

  test("moving a meeting into the future removes its untouched debrief; a rating is then refused", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      const id = await logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] })
      expect(await debriefOf(db, id)).toHaveLength(1)

      const rated = await sqlError(db, () =>
        updateMeeting(db, {
          p_meeting_id: id,
          p_starts_at: expr("now() + interval '1 day'"),
          p_rating: 3,
        }),
      )
      expect(rated.message).toBe("Rate the meeting after it happens.")

      await updateMeeting(db, { p_meeting_id: id, p_starts_at: expr("now() + interval '1 day'") })
      expect(await debriefOf(db, id)).toEqual([])
    })
  })

  test("is refused for an unknown meeting, signed-out visitors, and archived orgs", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      const id = await logMeeting(db, { p_organization_id: org.id, p_attendee_ids: [me.id] })

      const unknown = await sqlError(db, () =>
        updateMeeting(db, { p_meeting_id: "00000000-0000-4000-8000-000000000000" }),
      )
      expect(unknown.code).toBe(SqlState.noDataFound)

      await actAsAnon(db)
      const anon = await sqlError(db, () => updateMeeting(db, { p_meeting_id: id }))
      expect(anon.code).toBe(SqlState.insufficientPrivilege)

      await actAs(db, me.authUserId)
      await update(db, "organizations", org.id, { archived_at: sql("now()") })
      const archived = await sqlError(db, () => updateMeeting(db, { p_meeting_id: id }))
      expect(archived.code).toBe(SqlState.checkViolation)
    })
  })

  test("undo puts the edit back as one change: fields, who went and the next step", async () => {
    await withTx(async (db) => {
      const { me, mate, org } = await setup(db)
      const id = await logMeeting(db, {
        p_organization_id: org.id,
        p_attendee_ids: [me.id],
        p_rating: 3,
        p_summary: "OK",
      })
      // A separate statement (request), so the edit is its own change.
      await updateMeeting(db, {
        p_meeting_id: id,
        p_attendee_ids: [mate.id],
        p_rating: 5,
        p_summary: "Great",
        p_next_step: "Draft the term sheet",
        p_next_step_date: await dayFromToday(db, 4),
      })
      const edit = (await logFor(db, id)).find((l) => l.action === "update")!

      await undo(db, edit.id)

      expect(await find(db, "org_meetings", id)).toMatchObject({ rating: 3, summary: "OK" })
      expect(await attendeesOf(db, id)).toEqual([me.id])
      expect(await find(db, "organizations", org.id)).toMatchObject({ next_step: org.next_step })
    })
  })
})

describe("the meeting tables these functions write", () => {
  test("attendees are unique per meeting and are the only part teammates may delete", async () => {
    await withTx(async (db) => {
      const { me, org } = await setup(db)
      const meeting = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() - interval '1 hour'"),
      })
      await insert(db, "org_meeting_attendees", { org_meeting_id: meeting.id, person_id: me.id })
      const twice = await sqlError(db, () =>
        insert(db, "org_meeting_attendees", { org_meeting_id: meeting.id, person_id: me.id }),
      )
      expect(twice.code).toBe(SqlState.uniqueViolation)

      const removed = await rows(
        db,
        "delete from public.org_meeting_attendees where org_meeting_id = $1 returning id",
        [meeting.id],
      )
      expect(removed).toHaveLength(1)
      const meetingDelete = await sqlError(db, "delete from public.org_meetings where id = $1", [
        meeting.id,
      ])
      expect(meetingDelete.code).toBe(SqlState.insufficientPrivilege)
      expect(await meetingsOf(db, org.id)).toBe(1)
    })
  })
})
