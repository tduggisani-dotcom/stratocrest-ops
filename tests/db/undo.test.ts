import { afterAll, describe, expect, test } from "vitest"
import {
  SqlState,
  actAs,
  actAsAnon,
  actAsService,
  closeDb,
  createAuthUser,
  createBot,
  createOrg,
  createOrgMeeting,
  createPerson,
  createTask,
  createTeammate,
  find,
  insert,
  lastLogFor,
  logFor,
  one,
  resetRole,
  rows,
  sql,
  sqlError,
  undo,
  uniqueSuffix,
  update,
  withTx,
  withoutTriggers,
  type Db,
} from "./helpers"

/**
 * Undo (docs/ARCHITECTURE.md §4, spec §6.11): any activity-log entry can be
 * reversed by a person. A create is archived (or deleted where there is no
 * archive), an edit has its `before` values put back, a delete is re-inserted.
 * The undo is itself logged (action 'undo', undo_of = the reversed entry) and
 * runs with the caller's own rights.
 */

afterAll(closeDb)

const SerializationFailure = "40001"
const FeatureNotSupported = "0A000"

async function availabilityBlock(db: Db, personId: string) {
  return insert(db, "availability_blocks", {
    person_id: personId,
    weekday: 2,
    start_time: "09:00",
    end_time: "11:00",
    label: "class",
    note: "Statics lecture",
  })
}

/** The log entries written while undoing entry `logId`. */
async function undoEntriesOf(db: Db, logId: number) {
  return rows<{ id: number; action: string; actor_id: string | null; actor_kind: string }>(
    db,
    "select id, action, actor_id, actor_kind from public.activity_log where undo_of = $1 order by id",
    [logId],
  )
}

describe("undoing a create", () => {
  test("archives the record and logs an 'undo' entry pointing at the create", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      const created = await lastLogFor(db, task.id)
      expect(created.action).toBe("insert")

      await undo(db, created.id)

      const archived = await find(db, "tasks", task.id)
      expect(archived?.archived_at).not.toBeNull()
      const entry = await lastLogFor(db, task.id)
      expect(entry).toMatchObject({
        action: "undo",
        undo_of: created.id,
        actor_kind: "person",
        actor_id: me.id,
        changed_fields: ["archived_at"],
      })
      expect(entry.before).toMatchObject({ archived_at: null })
    })
  })

  test("deletes the record when its table has no archive (availability blocks)", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await availabilityBlock(db, me.id)
      const created = await lastLogFor(db, block.id)

      await undo(db, created.id)

      expect(await find(db, "availability_blocks", block.id)).toBeUndefined()
      const entry = await lastLogFor(db, block.id)
      expect(entry).toMatchObject({ action: "undo", undo_of: created.id, after: null })
      expect(entry.before).toMatchObject({ id: block.id, note: "Statics lecture" })
    })
  })

  test("is refused when the record no longer exists", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await availabilityBlock(db, me.id)
      const created = await lastLogFor(db, block.id)
      await db.query("delete from public.availability_blocks where id = $1", [block.id])

      const error = await sqlError(db, () => undo(db, created.id))
      expect(error.code).toBe(SqlState.noDataFound)
      expect(error.message).toMatch(/no longer exists/)
    })
  })

  test("a teammate can undo the bot logging an org meeting", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const org = await createOrg(db, { owner_id: me.id })
      const bot = await createBot(db)
      await actAsService(db, bot)
      const meeting = await createOrgMeeting(db, {
        organization_id: org.id,
        starts_at: sql("now() + interval '2 days'"),
      })
      const logged = await lastLogFor(db, meeting.id)

      await actAs(db, me.authUserId)
      await undo(db, logged.id)

      // Gone, or archived if org_meetings gains an archived_at column.
      const left = await rows<{ archived: boolean }>(
        db,
        "select (to_jsonb(m) ->> 'archived_at') is not null as archived from public.org_meetings m where id = $1",
        [meeting.id],
      )
      expect(left.every((r) => r.archived)).toBe(true)
    })
  })
})

describe("undoing an edit", () => {
  test("puts back exactly the changed fields", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id, next_step: "Email the partner" })
      await update(db, "organizations", org.id, { next_step: "Send the deck", stage: "contacted" })
      const edit = await lastLogFor(db, org.id)
      // A later edit to another field doesn't block the undo and isn't reverted.
      await update(db, "organizations", org.id, { notes: "Met at the Synthe6 mixer" })

      await undo(db, edit.id)

      const restored = await find(db, "organizations", org.id)
      expect(restored).toMatchObject({
        next_step: "Email the partner",
        stage: "identified",
        notes: "Met at the Synthe6 mixer",
        updated_by: me.id,
      })
      const entry = await lastLogFor(db, org.id)
      expect(entry).toMatchObject({
        action: "undo",
        undo_of: edit.id,
        changed_fields: ["next_step", "stage"],
      })
      expect(entry.before).toMatchObject({ next_step: "Send the deck", stage: "contacted" })
      expect(entry.after).toMatchObject({ next_step: "Email the partner", stage: "identified" })
    })
  })

  test("undoing an archive restores the record", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { archived_at: sql("now()") })
      const archived = await lastLogFor(db, task.id)
      expect(archived.action).toBe("archive")

      await undo(db, archived.id)

      expect((await find(db, "tasks", task.id))?.archived_at).toBeNull()
      expect((await lastLogFor(db, task.id)).action).toBe("undo")
    })
  })

  test("is refused when the field has changed since, unless forced", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const teammate = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id, next_action: "Call the foreman" })
      await update(db, "tasks", task.id, { next_action: "Email the foreman" })
      const edit = await lastLogFor(db, task.id)

      await actAs(db, teammate.authUserId)
      await update(db, "tasks", task.id, { next_action: "Visit the site" })

      await actAs(db, me.authUserId)
      const conflict = await sqlError(db, () => undo(db, edit.id))
      expect(conflict.code).toBe(SerializationFailure)
      expect(conflict.message).toMatch(/changed since.*next_action/)
      expect((await find(db, "tasks", task.id))?.next_action).toBe("Visit the site")
      expect(await undoEntriesOf(db, edit.id)).toEqual([])

      await undo(db, edit.id, true)
      expect((await find(db, "tasks", task.id))?.next_action).toBe("Call the foreman")
      expect(await undoEntriesOf(db, edit.id)).toHaveLength(1)
    })
  })

  test("reopening a task by undo clears completed_at again", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { status: "done" })
      const done = await lastLogFor(db, task.id)
      expect(done.changed_fields).toEqual(["completed_at", "status"])

      await undo(db, done.id)
      expect(await find(db, "tasks", task.id)).toMatchObject({
        status: "to_do",
        completed_at: null,
      })
    })
  })
})

describe("undoing a delete", () => {
  test("re-inserts the row with the same id and values", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await availabilityBlock(db, me.id)
      await db.query("delete from public.availability_blocks where id = $1", [block.id])
      const deleted = await lastLogFor(db, block.id)
      expect(deleted.action).toBe("delete")

      await undo(db, deleted.id)

      const back = await find(db, "availability_blocks", block.id)
      expect(back).toMatchObject({
        person_id: me.id,
        weekday: 2,
        start_time: "09:00:00",
        end_time: "11:00:00",
        label: "class",
        note: "Statics lecture",
      })
      const entry = await lastLogFor(db, block.id)
      expect(entry).toMatchObject({ action: "undo", undo_of: deleted.id, before: null })
      expect(entry.after).toMatchObject({ id: block.id })
    })
  })

  test("is refused when a row with that id exists again", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await availabilityBlock(db, me.id)
      await db.query("delete from public.availability_blocks where id = $1", [block.id])
      const deleted = await lastLogFor(db, block.id)
      await insert(db, "availability_blocks", {
        id: block.id,
        person_id: me.id,
        weekday: 5,
        start_time: "08:00",
        end_time: "09:00",
        label: "work",
      })

      const error = await sqlError(db, () => undo(db, deleted.id))
      expect(error.code).toBe(SqlState.uniqueViolation)
      expect(error.message).toMatch(/already exists/)
    })
  })

  // TODO(bug, minor): the common-columns trigger stamps every INSERT with now()
  // and the current actor, so a row brought back by undo claims it was created
  // by the person who undid the delete. Keep the original created_at/created_by
  // when app.undo_of is set.
  test("the re-inserted row keeps its original created_at and created_by", async () => {
    await withTx(async (db) => {
      const author = await createTeammate(db)
      const undoer = await createTeammate(db)
      await actAs(db, author.authUserId)
      const block = await availabilityBlock(db, author.id)
      await resetRole(db)
      await withoutTriggers(db, () =>
        db.query(
          "update public.availability_blocks set created_at = '2026-01-05T15:00:00Z' where id = $1",
          [block.id],
        ),
      )
      await actAs(db, author.authUserId)
      await db.query("delete from public.availability_blocks where id = $1", [block.id])
      const deleted = await lastLogFor(db, block.id)

      await actAs(db, undoer.authUserId)
      await undo(db, deleted.id)

      const back = await one(
        db,
        "select created_by, created_at = '2026-01-05T15:00:00Z' as same_created_at from public.availability_blocks where id = $1",
        [block.id],
      )
      expect(back).toEqual({ created_by: author.id, same_created_at: true })
    })
  })
})

describe("undo rules", () => {
  test("an entry can be undone only once", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { priority: "high" })
      const edit = await lastLogFor(db, task.id)
      await undo(db, edit.id)

      for (const force of [false, true]) {
        const again = await sqlError(db, () => undo(db, edit.id, force))
        expect(again.code).toBe(SqlState.uniqueViolation)
        expect(again.message).toMatch(/already been undone/)
      }
      expect(await undoEntriesOf(db, edit.id)).toHaveLength(1)
    })
  })

  test("undoing the undo of an edit re-applies the edit (redo)", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id, priority: "low" })
      await update(db, "tasks", task.id, { priority: "high" })
      const edit = await lastLogFor(db, task.id)
      await undo(db, edit.id)
      const undone = await lastLogFor(db, task.id)
      expect((await find(db, "tasks", task.id))?.priority).toBe("low")

      await undo(db, undone.id)

      expect((await find(db, "tasks", task.id))?.priority).toBe("high")
      const redone = await lastLogFor(db, task.id)
      expect(redone).toMatchObject({ action: "undo", undo_of: undone.id })
      expect((await logFor(db, task.id)).map((e) => e.action)).toEqual([
        "insert",
        "update",
        "undo",
        "undo",
      ])
    })
  })

  test("undoing the undo of a create brings the record back (redo)", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await availabilityBlock(db, me.id)
      const task = await createTask(db, { owner_id: me.id })

      // No archive: undo deletes, redo re-inserts.
      await undo(db, (await lastLogFor(db, block.id)).id)
      expect(await find(db, "availability_blocks", block.id)).toBeUndefined()
      await undo(db, (await lastLogFor(db, block.id)).id)
      expect(await find(db, "availability_blocks", block.id)).toMatchObject({
        note: "Statics lecture",
      })
      expect((await logFor(db, block.id)).map((e) => e.action)).toEqual(["insert", "undo", "undo"])

      // Archive: undo archives, redo restores.
      await undo(db, (await lastLogFor(db, task.id)).id)
      expect((await find(db, "tasks", task.id))?.archived_at).not.toBeNull()
      await undo(db, (await lastLogFor(db, task.id)).id)
      expect((await find(db, "tasks", task.id))?.archived_at).toBeNull()
    })
  })

  test("writes after an undo in the same transaction are logged normally", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { priority: "high" })
      await undo(db, (await lastLogFor(db, task.id)).id)

      const later = await createTask(db, { owner_id: me.id })
      expect(await lastLogFor(db, later.id)).toMatchObject({ action: "insert", undo_of: null })
    })
  })

  test("unknown entries and tables without undo are refused", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const notAuditable = await one<{ id: number }>(
        db,
        `insert into public.activity_log (actor_kind, action, entity_type, entity_id, after)
         values ('system', 'insert', 'feedback', gen_random_uuid(), '{}') returning id`,
      )
      await actAs(db, me.authUserId)

      const missing = await sqlError(db, () => undo(db, -1))
      expect(missing.code).toBe(SqlState.noDataFound)
      const unsupported = await sqlError(db, () => undo(db, notAuditable.id))
      expect(unsupported.code).toBe(FeatureNotSupported)
    })
  })
})

describe("who can undo", () => {
  async function editedTask(db: Db) {
    const owner = await createTeammate(db)
    await actAs(db, owner.authUserId)
    const task = await createTask(db, { owner_id: owner.id })
    const title = `Renamed ${uniqueSuffix()}`
    await update(db, "tasks", task.id, { title })
    const edit = await lastLogFor(db, task.id)
    await resetRole(db)
    return { task, edit, title }
  }

  test("signed-out visitors, inactive people and logins without a person can't", async () => {
    await withTx(async (db) => {
      const { task, edit, title } = await editedTask(db)
      const former = await createTeammate(db, { isActive: false })
      const stranger = await createAuthUser(db, `stranger-${uniqueSuffix()}@example.test`)

      await actAsAnon(db)
      const anon = await sqlError(db, () => undo(db, edit.id))
      expect(anon.code).toBe(SqlState.insufficientPrivilege)

      for (const login of [former.authUserId, stranger]) {
        await actAs(db, login)
        const refused = await sqlError(db, () => undo(db, edit.id))
        expect(refused.code).toBe(SqlState.insufficientPrivilege)
        expect(refused.message).toMatch(/Only team members/)
      }

      await resetRole(db)
      expect((await find(db, "tasks", task.id))?.title).toBe(title)
      expect(await undoEntriesOf(db, edit.id)).toEqual([])
    })
  })

  test("a teammate can undo the bot's edit", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const bot = await createBot(db, { name: "Grok Chief of Staff" })
      const task = await createTask(db, { owner_id: me.id, priority: "low" })

      await actAsService(db, bot)
      await update(db, "tasks", task.id, { priority: "high" })
      const botEdit = await lastLogFor(db, task.id)
      expect(botEdit.actor_kind).toBe("bot")

      await actAs(db, me.authUserId)
      await undo(db, botEdit.id)
      expect((await find(db, "tasks", task.id))?.priority).toBe("low")
      expect(await undoEntriesOf(db, botEdit.id)).toEqual([
        expect.objectContaining({ action: "undo", actor_kind: "person", actor_id: me.id }),
      ])
    })
  })

  test("the bot can undo through the server key, and is recorded as the actor", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const bot = await createBot(db, { name: "Grok Chief of Staff" })
      await actAsService(db, bot)
      const botTask = await createTask(db, { owner_id: me.id })
      const botCreate = await lastLogFor(db, botTask.id)

      await undo(db, botCreate.id)

      expect((await find(db, "tasks", botTask.id))?.archived_at).not.toBeNull()
      expect(await undoEntriesOf(db, botCreate.id)).toEqual([
        expect.objectContaining({ action: "undo", actor_kind: "bot", actor_id: bot }),
      ])
    })
  })

  test("undo runs with the caller's rights: no undoing what a teammate couldn't do by hand", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const person = await createPerson(db)
      const created = await lastLogFor(db, person.id)
      const email = `moved-${uniqueSuffix()}@example.test`
      await update(db, "people", person.id, { email })
      const emailChange = await lastLogFor(db, person.id)

      await actAs(db, me.authUserId)
      // Changing an email is server-only, so undoing it is too.
      const emailError = await sqlError(db, () => undo(db, emailChange.id))
      expect(emailError.code).toBe(SqlState.insufficientPrivilege)
      expect(emailError.message).toMatch(/permission denied/)
      // People are never deleted by undo (deactivate them instead).
      const createError = await sqlError(db, () => undo(db, created.id))
      expect(createError.code).toBe("0A000")
      expect(createError.message).toMatch(/cannot be removed by undo/)
      expect((await find(db, "people", person.id))?.email).toBe(email)
    })
  })
})
