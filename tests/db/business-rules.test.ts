import { afterAll, describe, expect, test } from "vitest"
import { ORG_KINDS, ORG_SUBTYPES, orgSubtypesByKind } from "@/lib/labels"
import {
  SqlState,
  actAs,
  closeDb,
  createObjective,
  createOrg,
  createOrgMeeting,
  createPerson,
  createSession,
  createTask,
  createTeammate,
  dayFromToday,
  find,
  insert,
  quarterId,
  rows,
  sameMoment,
  sql,
  sqlError,
  update,
  withTx,
  withoutTriggers,
  type Db,
} from "./helpers"

/**
 * Rules the database enforces for people and the bot alike (docs/DATA_MODEL.md
 * §5 and the CHECK/NOT NULL constraints behind spec "every item has one owner,
 * a concrete next step and a date").
 */

afterAll(closeDb)

async function debriefsFor(db: Db, orgMeetingId: string) {
  return rows<{
    kind: string
    due_date: string
    facilitator_id: string | null
    status: string
  }>(
    db,
    "select kind, due_date, facilitator_id, status from public.debriefs where org_meeting_id = $1",
    [orgMeetingId],
  )
}

describe("tasks", () => {
  test("completed_at is set when a task is done, kept while done, and cleared when reopened", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)

      const open = await createTask(db, { owner_id: me.id, completed_at: "2000-01-01T00:00:00Z" })
      expect(open.completed_at).toBeNull()

      const done = await update(db, "tasks", open.id, { status: "done" })
      expect(await sameMoment(db, done?.completed_at, "now")).toBe(true)

      // Created done: completed now, whatever the client sends.
      const createdDone = await createTask(db, {
        owner_id: me.id,
        status: "done",
        completed_at: "2000-01-01T00:00:00Z",
      })
      expect(await sameMoment(db, createdDone.completed_at, "now")).toBe(true)

      // Later edits keep the original completion time.
      await withoutTriggers(db, () =>
        db.query("update public.tasks set completed_at = '2026-01-05T15:00:00Z' where id = $1", [
          open.id,
        ]),
      )
      const edited = await update(db, "tasks", open.id, { notes: "Wrapped up", completed_at: null })
      expect(await sameMoment(db, edited?.completed_at, "2026-01-05T15:00:00Z")).toBe(true)

      const reopened = await update(db, "tasks", open.id, { status: "in_progress" })
      expect(reopened?.completed_at).toBeNull()
    })
  })

  test("title, next action, owner and due date are required and can't be blank", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      for (const values of [
        { title: "   " },
        { title: "" },
        { next_action: "  " },
        { next_action: "" },
      ]) {
        const error = await sqlError(db, () => createTask(db, { owner_id: owner.id, ...values }))
        expect(error.code, JSON.stringify(values)).toBe(SqlState.checkViolation)
      }
      const valid = {
        title: "Call the distributor",
        next_action: "Find their number",
        owner_id: owner.id,
        due_date: sql("app.today_et()"),
      }
      for (const column of Object.keys(valid) as (keyof typeof valid)[]) {
        const error = await sqlError(db, () =>
          insert(db, "tasks", { ...valid, [column]: sql("null") }),
        )
        expect(error.code, column).toBe(SqlState.notNullViolation)
      }
    })
  })
})

describe("organizations", () => {
  test("name, next step, owner and next-step date are required and can't be blank", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      for (const values of [{ name: "  " }, { name: "" }, { next_step: " " }, { next_step: "" }]) {
        const error = await sqlError(db, () => createOrg(db, { owner_id: owner.id, ...values }))
        expect(error.code, JSON.stringify(values)).toBe(SqlState.checkViolation)
      }
      const valid = {
        kind: "investor" as const,
        name: "Ownerless Capital",
        next_step: "Call",
        next_step_date: sql("app.today_et()"),
        owner_id: owner.id,
      }
      for (const column of Object.keys(valid) as (keyof typeof valid)[]) {
        const error = await sqlError(db, () =>
          insert(db, "organizations", { ...valid, [column]: sql("null") }),
        )
        expect(error.code, column).toBe(SqlState.notNullViolation)
      }
    })
  })

  // TODO(bug, minor): the "not blank" CHECKs use btrim(x) <> '', and btrim only
  // strips spaces, so text made of tabs or newlines passes. Zod trims in the app,
  // but the database is the last guard (bot API). Use `x ~ '[^[:space:]]'`.
  test("text made only of tabs or newlines counts as blank too", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      for (const blank of ["\t", "\n", " \r\n "]) {
        const task = await sqlError(db, () =>
          createTask(db, { owner_id: owner.id, next_action: blank }),
        )
        expect(task.code).toBe(SqlState.checkViolation)
        const org = await sqlError(db, () =>
          createOrg(db, { owner_id: owner.id, next_step: blank }),
        )
        expect(org.code).toBe(SqlState.checkViolation)
      }
    })
  })

  test("names are unique per kind among active records, ignoring case", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const first = await createOrg(db, {
        owner_id: owner.id,
        kind: "investor",
        name: "Buckeye Ventures",
      })

      const duplicate = await sqlError(db, () =>
        createOrg(db, { owner_id: owner.id, kind: "investor", name: "BUCKEYE ventures" }),
      )
      expect(duplicate.code).toBe(SqlState.uniqueViolation)

      // The same company can be tracked as a customer too.
      await createOrg(db, { owner_id: owner.id, kind: "customer", name: "Buckeye Ventures" })

      // Once archived, the name is free again; restoring the old one then clashes.
      await update(db, "organizations", first.id, { archived_at: sql("now()") })
      await createOrg(db, { owner_id: owner.id, kind: "investor", name: "buckeye ventures" })
      const restore = await sqlError(db, () =>
        update(db, "organizations", first.id, { archived_at: null }),
      )
      expect(restore.code).toBe(SqlState.uniqueViolation)
    })
  })

  test("kind can't change after creation", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id, kind: "investor" })
      const error = await sqlError(db, () =>
        update(db, "organizations", org.id, { kind: "customer" }),
      )
      expect(error.code).toBe(SqlState.checkViolation)
      expect(error.message).toMatch(/kind/)
      expect((await find(db, "organizations", org.id))?.kind).toBe("investor")
    })
  })

  test("subtype must fit the kind (matches orgSubtypesByKind in labels.ts)", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      for (const kind of ORG_KINDS) {
        const allowed: readonly string[] = orgSubtypesByKind[kind]
        for (const subtype of ORG_SUBTYPES) {
          const label = `${kind}/${subtype}`
          await db.query("savepoint subtype_check")
          const outcome = await createOrg(db, { owner_id: owner.id, kind, subtype }).then(
            () => "accepted",
            (error: { code?: string }) => error.code,
          )
          await db.query("rollback to savepoint subtype_check")
          expect(outcome, label).toBe(
            allowed.includes(subtype) ? "accepted" : SqlState.checkViolation,
          )
        }
      }
    })
  })

  test("stage must belong to the kind's pipeline", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      for (const [kind, stage] of [
        ["customer", "meeting"],
        ["customer", "committed"],
        ["investor", "discovery"],
        ["investor", "nope"],
      ] as const) {
        const error = await sqlError(db, () => createOrg(db, { owner_id: owner.id, kind, stage }))
        expect(error.code, `${kind}/${stage}`).toBe(SqlState.foreignKeyViolation)
      }
      const customer = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      expect(customer.stage).toBe("identified")
      const moved = await update(db, "organizations", customer.id, { stage: "pilot_active" })
      expect(moved?.stage).toBe("pilot_active")
      const wrong = await sqlError(db, () =>
        update(db, "organizations", customer.id, { stage: "diligence" }),
      )
      expect(wrong.code).toBe(SqlState.foreignKeyViolation)
    })
  })
})

describe("org meetings", () => {
  test("a past meeting sets last contact to its ET day and creates the debrief", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const owner = await createPerson(db)
      await actAs(db, me.authUserId)
      for (const kind of ORG_KINDS) {
        const org = await createOrg(db, { owner_id: owner.id, kind })
        // 02:30 UTC on 4 July is 22:30 EDT on 3 July.
        const meeting = await createOrgMeeting(db, {
          organization_id: org.id,
          starts_at: "2025-07-04T02:30:00Z",
        })
        expect((await find(db, "organizations", org.id))?.last_contact_date, kind).toBe(
          "2025-07-03",
        )
        expect(await debriefsFor(db, meeting.id), kind).toEqual([
          { kind, due_date: "2025-07-03", facilitator_id: owner.id, status: "due" },
        ])
      }
    })
  })

  test("last contact only moves forward", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const today = await dayFromToday(db, 0)
      const org = await createOrg(db, { owner_id: owner.id, last_contact_date: today })
      await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("app.et_moment(app.today_et() - 3, '10:00')"),
      })
      expect((await find(db, "organizations", org.id))?.last_contact_date).toBe(today)

      const older = await createOrg(db, {
        owner_id: owner.id,
        last_contact_date: await dayFromToday(db, -10),
      })
      await createOrgMeeting(db, {
        organization_id: older.id,
        starts_at: sql("app.et_moment(app.today_et() - 2, '10:00')"),
      })
      expect((await find(db, "organizations", older.id))?.last_contact_date).toBe(
        await dayFromToday(db, -2),
      )
    })
  })

  test("a future meeting doesn't count as contact and has no debrief until it moves into the past", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const org = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      const meeting = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() + interval '3 days'"),
      })
      expect((await find(db, "organizations", org.id))?.last_contact_date).toBeNull()
      expect(await debriefsFor(db, meeting.id)).toEqual([])

      await update(db, "org_meetings", meeting.id, {
        starts_at: sql("app.et_moment(app.today_et() - 1, '15:00')"),
      })
      const yesterday = await dayFromToday(db, -1)
      expect((await find(db, "organizations", org.id))?.last_contact_date).toBe(yesterday)
      expect(await debriefsFor(db, meeting.id)).toEqual([
        { kind: "customer", due_date: yesterday, facilitator_id: owner.id, status: "due" },
      ])

      // Editing the meeting again doesn't create a second debrief.
      await update(db, "org_meetings", meeting.id, {
        starts_at: sql("app.et_moment(app.today_et() - 1, '16:00')"),
      })
      expect(await debriefsFor(db, meeting.id)).toHaveLength(1)
    })
  })

  test("a follow-up has both an owner and a date, or neither", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const org = await createOrg(db, { owner_id: owner.id })
      const base = { organization_id: org.id, starts_at: sql("now() + interval '1 day'") }
      for (const values of [
        { follow_up_owner_id: owner.id },
        { follow_up_date: await dayFromToday(db, 3) },
      ]) {
        const error = await sqlError(db, () => createOrgMeeting(db, { ...base, ...values }))
        expect(error.code, Object.keys(values)[0]).toBe(SqlState.checkViolation)
      }
      const both = await createOrgMeeting(db, {
        ...base,
        follow_up_owner_id: owner.id,
        follow_up_date: await dayFromToday(db, 3),
      })
      const clearOne = await sqlError(db, () =>
        update(db, "org_meetings", both.id, { follow_up_date: null }),
      )
      expect(clearOne.code).toBe(SqlState.checkViolation)
      const cleared = await update(db, "org_meetings", both.id, {
        follow_up_owner_id: null,
        follow_up_date: null,
      })
      expect(cleared?.follow_up_owner_id).toBeNull()
    })
  })
})

describe("key results", () => {
  test("an objective has at most 4 active key results", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const quarter = await quarterId(db)
      const objective = await createObjective(db, me.id, quarter)
      const keyResult = (objectiveId: string, n: number) =>
        insert(db, "key_results", {
          objective_id: objectiveId,
          title: `KR ${n}`,
          target_value: 10,
          owner_id: me.id,
        })

      const first = await keyResult(objective.id, 1)
      for (let n = 2; n <= 4; n++) await keyResult(objective.id, n)
      const fifth = await sqlError(db, () => keyResult(objective.id, 5))
      expect(fifth.code).toBe(SqlState.checkViolation)
      expect(fifth.message).toMatch(/at most 4/)

      // Archiving one makes room; restoring it then is refused.
      await update(db, "key_results", first.id, { archived_at: sql("now()") })
      await keyResult(objective.id, 5)
      const restore = await sqlError(db, () =>
        update(db, "key_results", first.id, { archived_at: null }),
      )
      expect(restore.code).toBe(SqlState.checkViolation)

      // Moving one in from another objective counts too.
      const other = await createObjective(db, me.id, quarter)
      const mover = await keyResult(other.id, 1)
      const move = await sqlError(db, () =>
        update(db, "key_results", mover.id, { objective_id: objective.id }),
      )
      expect(move.code).toBe(SqlState.checkViolation)
    })
  })
})

describe("debriefs", () => {
  async function teamMeeting(db: Db, facilitatorId: string, date: string) {
    return insert(db, "team_meetings", { meeting_date: date, facilitator_id: facilitatorId })
  }

  test("link to exactly one event, of the matching kind", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      const meeting = await teamMeeting(db, person.id, "2030-07-07")
      const session = await createSession(db, { end_date: "2000-03-01" })
      const today = sql("app.today_et()")

      const refused = [
        { kind: "team_meeting", due_date: today },
        {
          kind: "team_meeting",
          team_meeting_id: meeting.id,
          synthe6_session_id: session.id,
          due_date: today,
        },
        { kind: "team_meeting", synthe6_session_id: session.id, due_date: today },
        { kind: "synthe6", team_meeting_id: meeting.id, due_date: today },
        { kind: "mentor", team_meeting_id: meeting.id, due_date: today },
        { kind: "investor", synthe6_session_id: session.id, due_date: today },
      ] as const
      for (const values of refused) {
        const error = await sqlError(db, () => insert(db, "debriefs", values))
        expect(error.code, JSON.stringify(values)).toBe(SqlState.checkViolation)
      }

      await insert(db, "debriefs", {
        kind: "mentor",
        synthe6_session_id: session.id,
        due_date: today,
      })
      await insert(db, "debriefs", {
        kind: "team_meeting",
        team_meeting_id: meeting.id,
        due_date: today,
      })
      const twice = await sqlError(db, () =>
        insert(db, "debriefs", {
          kind: "team_meeting",
          team_meeting_id: meeting.id,
          due_date: today,
        }),
      )
      expect(twice.code).toBe(SqlState.uniqueViolation)
    })
  })

  test("an org-meeting debrief's kind always follows the org", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const org = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      const meeting = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() + interval '1 day'"),
      })
      const debrief = await insert(db, "debriefs", {
        kind: "investor",
        org_meeting_id: meeting.id,
        due_date: sql("app.today_et() + 1"),
      })
      expect(debrief.kind).toBe("customer")
      const edited = await update(db, "debriefs", debrief.id, { kind: "investor" })
      expect(edited?.kind).toBe("customer")
    })
  })

  test("completed_at follows status", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const meeting = await teamMeeting(db, me.id, "2030-07-14")
      const debrief = await insert(db, "debriefs", {
        kind: "team_meeting",
        team_meeting_id: meeting.id,
        due_date: sql("app.today_et()"),
        completed_at: "2000-01-01T00:00:00Z",
      })
      expect(debrief).toMatchObject({ status: "due", completed_at: null })

      const done = await update(db, "debriefs", debrief.id, {
        status: "done",
        worked: "Clear roles",
      })
      expect(await sameMoment(db, done?.completed_at, "now")).toBe(true)

      const reopened = await update(db, "debriefs", debrief.id, { status: "due" })
      expect(reopened?.completed_at).toBeNull()

      const createdDone = await insert(db, "debriefs", {
        kind: "team_meeting",
        team_meeting_id: (await teamMeeting(db, me.id, "2030-07-21")).id,
        due_date: sql("app.today_et()"),
        status: "done",
      })
      expect(await sameMoment(db, createdDone.completed_at, "now")).toBe(true)
    })
  })
})

describe("Sunday team meetings", () => {
  test("only fall on Sundays", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      for (const date of ["2030-07-06", "2030-07-08", "2030-07-12"]) {
        const error = await sqlError(db, () =>
          insert(db, "team_meetings", { meeting_date: date, facilitator_id: person.id }),
        )
        expect(error.code, date).toBe(SqlState.checkViolation)
      }
    })
  })

  test("start at 9:00 AM ET by default, in summer (EDT) and winter (EST), including DST change days", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      for (const [date, utc] of [
        ["2030-07-07", "2030-07-07T13:00:00Z"], // EDT
        ["2030-11-03", "2030-11-03T14:00:00Z"], // clocks went back at 2 AM: EST
        ["2030-12-01", "2030-12-01T14:00:00Z"], // EST
        ["2031-03-09", "2031-03-09T13:00:00Z"], // clocks went forward at 2 AM: EDT
      ]) {
        const meeting = await insert(db, "team_meetings", {
          meeting_date: date,
          facilitator_id: person.id,
        })
        expect(await sameMoment(db, meeting.starts_at, utc), date).toBe(true)
        expect(meeting.status).toBe("upcoming")
      }
    })
  })

  test("keep an explicit start time, and follow the date when it moves", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      const custom = await insert(db, "team_meetings", {
        meeting_date: "2030-07-07",
        facilitator_id: person.id,
        starts_at: "2030-07-07T14:30:00Z",
      })
      expect(await sameMoment(db, custom.starts_at, "2030-07-07T14:30:00Z")).toBe(true)

      // Date moves (EDT → EST): 9:00 ET on the new day.
      const moved = await update(db, "team_meetings", custom.id, { meeting_date: "2030-12-08" })
      expect(await sameMoment(db, moved?.starts_at, "2030-12-08T14:00:00Z")).toBe(true)

      // Date and time move together: the given time wins.
      const both = await update(db, "team_meetings", custom.id, {
        meeting_date: "2030-12-15",
        starts_at: "2030-12-15T16:00:00Z",
      })
      expect(await sameMoment(db, both?.starts_at, "2030-12-15T16:00:00Z")).toBe(true)

      // Only the time moves.
      const later = await update(db, "team_meetings", custom.id, {
        starts_at: "2030-12-15T17:00:00Z",
      })
      expect(later?.meeting_date).toBe("2030-12-15")
      expect(await sameMoment(db, later?.starts_at, "2030-12-15T17:00:00Z")).toBe(true)
    })
  })
})

describe("checklist items", () => {
  test("ticking records who and when; unticking clears both; re-saving keeps the original", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const teammate = await createTeammate(db)
      const other = await createPerson(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      const checklist = await insert(db, "checklists", { title: "Pitch prep", task_id: task.id })
      const item = await insert(db, "checklist_items", {
        checklist_id: checklist.id,
        text: "Print one-pagers",
        done_by: other.id,
      })
      expect(item).toMatchObject({ done_at: null, done_by: null })

      const ticked = await update(db, "checklist_items", item.id, {
        done_at: "2000-01-01T00:00:00Z",
        done_by: other.id,
      })
      expect(ticked?.done_by).toBe(me.id)
      expect(await sameMoment(db, ticked?.done_at, "now")).toBe(true)

      // Someone else re-saves the ticked item: who/when stay.
      await withoutTriggers(db, () =>
        db.query(
          "update public.checklist_items set done_at = '2026-01-05T15:00:00Z' where id = $1",
          [item.id],
        ),
      )
      await actAs(db, teammate.authUserId)
      const resaved = await update(db, "checklist_items", item.id, {
        hint: "Color, double-sided",
        done_at: sql("now()"),
        done_by: teammate.id,
      })
      expect(resaved?.done_by).toBe(me.id)
      expect(await sameMoment(db, resaved?.done_at, "2026-01-05T15:00:00Z")).toBe(true)

      const unticked = await update(db, "checklist_items", item.id, { done_at: null })
      expect(unticked).toMatchObject({ done_at: null, done_by: null })

      // Created already ticked: recorded for whoever created it.
      const preTicked = await insert(db, "checklist_items", {
        checklist_id: checklist.id,
        text: "Book the room",
        done_at: "2000-01-01T00:00:00Z",
      })
      expect(preTicked.done_by).toBe(teammate.id)
      expect(await sameMoment(db, preTicked.done_at, "now")).toBe(true)
    })
  })
})

describe("hypotheses", () => {
  test("audience is copied from the linked org and follows it when the link changes", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const customer = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      const investor = await createOrg(db, { owner_id: owner.id, kind: "investor" })

      const linked = await insert(db, "hypotheses", {
        organization_id: customer.id,
        audience: "investor",
        statement: "Site managers will pay for real-time alerts",
      })
      expect(linked.audience).toBe("customer")

      const relinked = await update(db, "hypotheses", linked.id, { organization_id: investor.id })
      expect(relinked?.audience).toBe("investor")

      // Not linked to one org: set by hand.
      const general = await insert(db, "hypotheses", {
        audience: "customer",
        statement: "Distributors want a reseller margin",
      })
      expect(general.audience).toBe("customer")
    })
  })

  test("editing audience on a linked hypothesis keeps the org's kind", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const customer = await createOrg(db, { owner_id: owner.id, kind: "customer" })
      const hypothesis = await insert(db, "hypotheses", {
        organization_id: customer.id,
        statement: "Foremen check alerts on their phones",
      })
      const edited = await update(db, "hypotheses", hypothesis.id, { audience: "investor" })
      expect(edited?.audience).toBe("customer")
    })
  })
})

describe("help requests", () => {
  test("point at an item with both a type and an id, or neither", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      const base = { requester_id: me.id, message: "Can someone review this?" }

      for (const values of [
        { entity_type: "tasks" },
        { entity_id: task.id },
        { entity_type: "feedback", entity_id: task.id },
      ]) {
        const error = await sqlError(db, () => insert(db, "help_requests", { ...base, ...values }))
        expect(error.code, JSON.stringify(values)).toBe(SqlState.checkViolation)
      }
      await insert(db, "help_requests", { ...base, entity_type: "tasks", entity_id: task.id })
      const general = await insert(db, "help_requests", base)

      // Resolving needs both who and when.
      const half = await sqlError(db, () =>
        update(db, "help_requests", general.id, { resolved_by: me.id }),
      )
      expect(half.code).toBe(SqlState.checkViolation)
      const resolved = await update(db, "help_requests", general.id, {
        resolved_by: me.id,
        resolved_at: sql("now()"),
        resolution_note: "Reviewed together",
      })
      expect(resolved?.resolved_by).toBe(me.id)
    })
  })
})

describe("other one-of-a-kind links", () => {
  test("action items belong to exactly one meeting or debrief; checklists to exactly one thing", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      const meeting = await insert(db, "team_meetings", {
        meeting_date: "2030-07-07",
        facilitator_id: person.id,
      })
      const debrief = await insert(db, "debriefs", {
        kind: "team_meeting",
        team_meeting_id: meeting.id,
        due_date: sql("app.today_et()"),
      })
      for (const values of [{}, { team_meeting_id: meeting.id, debrief_id: debrief.id }]) {
        const error = await sqlError(db, () =>
          insert(db, "action_items", { description: "Follow up", ...values }),
        )
        expect(error.code).toBe(SqlState.checkViolation)
      }

      const task = await createTask(db, { owner_id: person.id })
      for (const values of [{}, { task_id: task.id, person_id: person.id }]) {
        const error = await sqlError(db, () =>
          insert(db, "checklists", { title: "Onboarding", ...values }),
        )
        expect(error.code).toBe(SqlState.checkViolation)
      }
    })
  })
})
