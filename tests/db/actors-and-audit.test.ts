import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, test } from "vitest"
import {
  actAs,
  actAsService,
  closeDb,
  createAuthUser,
  createBot,
  createOrg,
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
  scalar,
  sql,
  uniqueSuffix,
  update,
  withTx,
  type Db,
} from "./helpers"

/**
 * Who did it (docs/DATA_MODEL.md §1, §5 "How the database knows who is acting")
 * and the audit trail (§3.7, §5 rule 2).
 */

afterAll(closeDb)

/** created_by / updated_by and the audit entry's actor for a fresh org. */
async function authorOfNewOrg(db: Db, ownerId: string) {
  const org = await createOrg(db, { owner_id: ownerId })
  await resetRole(db)
  const entry = await lastLogFor(db, org.id)
  return {
    createdBy: org.created_by,
    updatedBy: org.updated_by,
    actorKind: entry.actor_kind,
    actorId: entry.actor_id,
  }
}

describe("people, actors and logins", () => {
  test("adding a person creates their actor row and keeps it in sync", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db, { name: "Avery Test" })
      const actor = await one(
        db,
        "select kind, display_name, is_active from public.actors where id = $1",
        [person.id],
      )
      expect(actor).toEqual({ kind: "person", display_name: "Avery Test", is_active: true })

      await update(db, "people", person.id, { name: "Avery Renamed", is_active: false })
      const synced = await one(
        db,
        "select display_name, is_active from public.actors where id = $1",
        [person.id],
      )
      expect(synced).toEqual({ display_name: "Avery Renamed", is_active: false })
    })
  })

  test("a login links to its person by email, whichever is created first", async () => {
    await withTx(async (db) => {
      // Person first, then the login (case-insensitive email match).
      const suffix = uniqueSuffix()
      const person = await createPerson(db, { email: `Link-${suffix}@Example.test` })
      const login = await createAuthUser(db, `link-${suffix}@example.test`)
      expect((await find(db, "people", person.id))?.auth_user_id).toBe(login)

      // Login first, then the person.
      const email = `later-${uniqueSuffix()}@example.test`
      const earlyLogin = await createAuthUser(db, email)
      const later = await createPerson(db, { email })
      expect(later.auth_user_id).toBe(earlyLogin)
    })
  })

  test("an unconfirmed login is never linked, in either order, until it's confirmed", async () => {
    await withTx(async (db) => {
      // Someone signs up with a teammate's address before the person exists…
      const email = `newhire-${uniqueSuffix()}@example.test`
      const squatter = await createAuthUser(db, email, { confirmed: false })
      const person = await createPerson(db, { email })
      expect(person.auth_user_id).toBeNull()

      // …or after.
      const other = await createPerson(db)
      const unconfirmed = await createAuthUser(db, other.email, { confirmed: false })
      expect((await find(db, "people", other.id))?.auth_user_id).toBeNull()

      // Confirming the email (the real owner clicked the link) links it.
      await db.query("update auth.users set email_confirmed_at = now() where id = $1", [
        unconfirmed,
      ])
      expect((await find(db, "people", other.id))?.auth_user_id).toBe(unconfirmed)
      expect((await find(db, "people", person.id))?.auth_user_id).toBeNull()
      expect(squatter).toBeTruthy()
    })
  })
})

describe("common columns and the acting actor", () => {
  test("a teammate is recorded as the author, whatever the client sends", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const other = await createPerson(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, {
        owner_id: me.id,
        created_by: other.id,
        updated_by: other.id,
        created_at: "2000-01-01T00:00:00Z",
        updated_at: "2000-01-01T00:00:00Z",
      })
      expect(task.created_by).toBe(me.id)
      expect(task.updated_by).toBe(me.id)
      expect(await scalar(db, "select $1::timestamptz = now()", [task.created_at])).toBe(true)
      expect(await scalar(db, "select $1::timestamptz = now()", [task.updated_at])).toBe(true)
    })
  })

  test("an edit keeps created_by and records the editor in updated_by", async () => {
    await withTx(async (db) => {
      const author = await createTeammate(db)
      const editor = await createTeammate(db)
      await actAs(db, author.authUserId)
      const task = await createTask(db, { owner_id: author.id })

      await actAs(db, editor.authUserId)
      const edited = await update(db, "tasks", task.id, {
        notes: "Edited",
        created_by: editor.id,
        created_at: "2000-01-01T00:00:00Z",
      })
      expect(edited?.created_by).toBe(author.id)
      expect(edited?.created_at).toBe(task.created_at)
      expect(edited?.updated_by).toBe(editor.id)
    })
  })

  test("the server key with an active bot's x-actor-id records the bot", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const bot = await createBot(db, { name: "Grok Chief of Staff" })
      await actAsService(db, bot)
      expect(await authorOfNewOrg(db, owner.id)).toEqual({
        createdBy: bot,
        updatedBy: bot,
        actorKind: "bot",
        actorId: bot,
      })
    })
  })

  test("the server key with a person's id (server actions) records that person", async () => {
    await withTx(async (db) => {
      const person = await createPerson(db)
      await actAsService(db, person.id)
      expect(await authorOfNewOrg(db, person.id)).toEqual({
        createdBy: person.id,
        updatedBy: person.id,
        actorKind: "person",
        actorId: person.id,
      })
    })
  })

  test("the x-actor-id header is ignored for signed-in users (no spoofing the bot)", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      const bot = await createBot(db)
      await actAs(db, me.authUserId, { "x-actor-id": bot })
      expect(await authorOfNewOrg(db, me.id)).toEqual({
        createdBy: me.id,
        updatedBy: me.id,
        actorKind: "person",
        actorId: me.id,
      })

      // A login without a person row gets no actor at all from the header.
      const stranger = await createAuthUser(db, `stranger-${uniqueSuffix()}@example.test`)
      await actAs(db, stranger, { "x-actor-id": bot })
      expect(await scalar(db, "select app.current_actor_id()")).toBeNull()
      expect(await scalar(db, "select app.current_actor_kind()")).toBe("system")
    })
  })

  test("an inactive bot, an unknown id or a malformed header falls back to system", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const retiredBot = await createBot(db, { isActive: false })
      const system = { createdBy: null, updatedBy: null, actorKind: "system", actorId: null }

      for (const header of [retiredBot, randomUUID(), "not-a-uuid", "'; drop table x; --"]) {
        await actAsService(db, header)
        expect(await authorOfNewOrg(db, owner.id), header).toEqual(system)
      }
      await actAsService(db)
      expect(await authorOfNewOrg(db, owner.id)).toEqual(system)
    })
  })

  test("plain postgres (scheduled jobs, migrations) is recorded as system", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      expect(await authorOfNewOrg(db, owner.id)).toEqual({
        createdBy: null,
        updatedBy: null,
        actorKind: "system",
        actorId: null,
      })
    })
  })
})

describe("audit trail", () => {
  test("an insert is logged with the full row as `after`", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id, name: "Audit Insert Org" })

      const [entry] = await logFor(db, org.id)
      expect(entry).toMatchObject({
        action: "insert",
        entity_type: "organizations",
        entity_id: org.id,
        actor_kind: "person",
        actor_id: me.id,
        before: null,
        changed_fields: null,
        undo_of: null,
      })
      expect(entry.after).toMatchObject({ id: org.id, name: "Audit Insert Org", kind: "investor" })
    })
  })

  test("an update records before, after and the changed fields (bookkeeping columns excluded)", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id, next_step: "Email the partner" })
      await update(db, "organizations", org.id, { next_step: "Send the deck", stage: "contacted" })

      const entry = await lastLogFor(db, org.id)
      expect(entry.action).toBe("update")
      expect(entry.changed_fields).toEqual(["next_step", "stage"])
      expect(entry.before).toMatchObject({ next_step: "Email the partner", stage: "identified" })
      expect(entry.after).toMatchObject({ next_step: "Send the deck", stage: "contacted" })
    })
  })

  test("archiving and restoring are logged as archive and restore", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const task = await createTask(db, { owner_id: me.id })
      await update(db, "tasks", task.id, { archived_at: sql("now()") })
      await update(db, "tasks", task.id, { archived_at: null })

      const entries = await logFor(db, task.id)
      expect(entries.map((e) => [e.action, e.changed_fields])).toEqual([
        ["insert", null],
        ["archive", ["archived_at"]],
        ["restore", ["archived_at"]],
      ])
    })
  })

  test("a delete is logged with the old row as `before`", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const block = await insert(db, "availability_blocks", {
        person_id: me.id,
        weekday: 3,
        start_time: "13:00",
        end_time: "15:00",
        label: "work",
      })
      await db.query("delete from public.availability_blocks where id = $1", [block.id])

      const entry = await lastLogFor(db, block.id)
      expect(entry).toMatchObject({ action: "delete", after: null, actor_id: me.id })
      expect(entry.before).toMatchObject({ id: block.id, weekday: 3, label: "work" })
    })
  })

  test("an update that changes nothing writes no entry", async () => {
    await withTx(async (db) => {
      const me = await createTeammate(db)
      await actAs(db, me.authUserId)
      const org = await createOrg(db, { owner_id: me.id })
      await db.query("update public.organizations set name = name, notes = notes where id = $1", [
        org.id,
      ])
      expect(await logFor(db, org.id)).toHaveLength(1)
    })
  })

  test("a save by someone else with the same values (only updated_by changes) writes no entry", async () => {
    await withTx(async (db) => {
      const author = await createTeammate(db)
      const saver = await createTeammate(db)
      await actAs(db, author.authUserId)
      const task = await createTask(db, { owner_id: author.id })

      await actAs(db, saver.authUserId)
      const saved = await update(db, "tasks", task.id, { title: task.title })
      expect(saved?.updated_by).toBe(saver.id)
      expect(await logFor(db, task.id)).toHaveLength(1)
    })
  })

  test("a change that only moves updated_at writes no entry", async () => {
    await withTx(async (db) => {
      const owner = await createPerson(db)
      const task = await createTask(db, { owner_id: owner.id })
      // Backdate updated_at without firing triggers, so the next save moves it.
      await db.query("set local session_replication_role = replica")
      await db.query(
        "update public.tasks set updated_at = now() - interval '1 day' where id = $1",
        [task.id],
      )
      await db.query("set local session_replication_role = origin")

      await db.query("update public.tasks set title = title where id = $1", [task.id])
      const after = await find(db, "tasks", task.id)
      expect(await scalar(db, "select $1::timestamptz = now()", [after?.updated_at])).toBe(true)
      expect(await logFor(db, task.id)).toHaveLength(1)
    })
  })

  test("every business table carries the common-columns and audit triggers", async () => {
    await withTx(async (db) => {
      const missing = await rows(
        db,
        `select c.relname, t.tgname
           from pg_class c
          cross join unnest(array['set_common_columns', 'audit']) t(tgname)
          where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
            and exists (select 1 from pg_attribute a
                         where a.attrelid = c.oid and a.attname = 'updated_by' and not a.attisdropped)
            and not exists (select 1 from pg_trigger g
                             where g.tgrelid = c.oid and g.tgname = t.tgname and g.tgenabled <> 'D')`,
      )
      expect(missing).toEqual([])
    })
  })
})
