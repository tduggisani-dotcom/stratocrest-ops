import { randomUUID } from "node:crypto"
import {
  DatabaseError,
  Pool,
  TypeOverrides,
  escapeIdentifier,
  escapeLiteral,
  types,
  type PoolClient,
  type QueryResultRow,
} from "pg"
import type { Database, Json } from "@/types/database"

/**
 * Helpers for the database tests (Vitest project "db"). They talk to the local
 * Supabase Postgres (`pnpm db:start`) as `postgres`, and switch to the API roles
 * (`anon`, `authenticated`, `service_role`) the same way PostgREST does: a role
 * plus `request.jwt.claims` / `request.headers` settings.
 *
 * Every test runs inside BEGIN … ROLLBACK (`withTx`), so nothing is left behind
 * and the tests pass whether or not the database has been seeded. `now()` is
 * fixed for the whole transaction, so build time-relative data from SQL
 * (`sql("now() - interval '1 day'")`, `sql("app.today_et() - 3")`).
 */

export type Db = PoolClient
type Schema = Database["public"]
export type TableName = keyof Schema["Tables"]
export type TableRow<T extends TableName> = Schema["Tables"][T]["Row"]
export type ViewRow<V extends keyof Schema["Views"]> = Schema["Views"][V]["Row"]
type Row = Record<string, unknown>

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

/** SQLSTATE codes the tests check for. */
export const SqlState = {
  insufficientPrivilege: "42501", // no privilege, or a row-level security policy refused the row
  checkViolation: "23514",
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
  serializationFailure: "40001",
  noDataFound: "P0002",
} as const

// Keep dates and timestamps as the strings Postgres sends (no JS Date time-zone
// surprises), and read counts, bigint ids and numerics as numbers.
const typeOverrides = new TypeOverrides()
const asText = (value: string) => value
typeOverrides.setTypeParser(types.builtins.DATE, asText)
typeOverrides.setTypeParser(types.builtins.TIMESTAMP, asText)
typeOverrides.setTypeParser(types.builtins.TIMESTAMPTZ, asText)
typeOverrides.setTypeParser(types.builtins.INT8, Number)
typeOverrides.setTypeParser(types.builtins.NUMERIC, Number)

const pool = new Pool({ connectionString: DATABASE_URL, max: 1, types: typeOverrides })

/** Run `fn` in a transaction that is always rolled back. */
export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect()
  let broken: Error | undefined
  try {
    await db.query("begin")
    return await fn(db)
  } finally {
    try {
      await db.query("rollback")
    } catch (error) {
      broken = error instanceof Error ? error : new Error(String(error))
    }
    db.release(broken)
  }
}

/** Close the connection pool. Call from `afterAll` in each test file. */
export async function closeDb(): Promise<void> {
  await pool.end()
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function rows<T extends QueryResultRow = Row>(
  db: Db,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await db.query<T>(text, values)).rows
}

/** Exactly one row, or throw. */
export async function one<T extends QueryResultRow = Row>(
  db: Db,
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await rows<T>(db, text, values)
  if (result.length !== 1) throw new Error(`Expected 1 row, got ${result.length}: ${text}`)
  return result[0]
}

/** The only column of the only row. */
export async function scalar<T>(db: Db, text: string, values: unknown[] = []): Promise<T> {
  const row = await one(db, text, values)
  return Object.values(row)[0] as T
}

/**
 * Run `action` (a SQL string or a callback) inside a savepoint, expect the
 * database to reject it, and return the error. The transaction stays usable.
 */
export async function sqlError(
  db: Db,
  action: string | (() => Promise<unknown>),
  values: unknown[] = [],
): Promise<DatabaseError> {
  await db.query("savepoint expected_failure")
  try {
    await (typeof action === "string" ? db.query(action, values) : action())
  } catch (error) {
    await db.query("rollback to savepoint expected_failure")
    if (error instanceof DatabaseError) return error
    throw error
  }
  await db.query("release savepoint expected_failure")
  throw new Error("Expected the database to reject this, but it succeeded.")
}

/** How many rows of `relation` the current role can see, or "denied" without the privilege. */
export async function visibleRows(db: Db, relation: string): Promise<number | "denied"> {
  await db.query("savepoint visible_rows")
  try {
    const count = await scalar<number>(
      db,
      `select count(*) from public.${escapeIdentifier(relation)}`,
    )
    await db.query("release savepoint visible_rows")
    return count
  } catch (error) {
    await db.query("rollback to savepoint visible_rows")
    if (error instanceof DatabaseError && error.code === SqlState.insufficientPrivilege) {
      return "denied"
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Inserts and updates with typed columns
// ---------------------------------------------------------------------------

const RAW = Symbol("raw sql")
/** A SQL expression used as a column value. */
export type Raw = { readonly [RAW]: string }
export function sql(expression: string): Raw {
  return { [RAW]: expression }
}
function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && RAW in value
}

type WithRaw<T> = { [K in keyof T]?: T[K] | Raw }
export type Insertable<T extends TableName> = WithRaw<Schema["Tables"][T]["Insert"]>
export type Updatable<T extends TableName> = WithRaw<Schema["Tables"][T]["Update"]>

function toSql(values: Record<string, unknown>) {
  const columns: string[] = []
  const expressions: string[] = []
  const params: unknown[] = []
  for (const [column, value] of Object.entries(values)) {
    if (value === undefined) continue
    columns.push(escapeIdentifier(column))
    if (isRaw(value)) {
      expressions.push(value[RAW])
    } else {
      params.push(value)
      expressions.push(`$${params.length}`)
    }
  }
  return { columns, expressions, params }
}

/** Insert one row as the current role and return it (`returning *`). */
export async function insert<T extends TableName>(
  db: Db,
  table: T,
  values: Insertable<T>,
): Promise<TableRow<T>> {
  const { columns, expressions, params } = toSql(values)
  return one<TableRow<T>>(
    db,
    `insert into public.${escapeIdentifier(table)} (${columns.join(", ")})
     values (${expressions.join(", ")}) returning *`,
    params,
  )
}

/** Update one row by id as the current role; undefined when no row was visible to update. */
export async function update<T extends TableName>(
  db: Db,
  table: T,
  id: string,
  values: Updatable<T>,
): Promise<TableRow<T> | undefined> {
  const { columns, expressions, params } = toSql(values)
  const assignments = columns.map((column, i) => `${column} = ${expressions[i]}`)
  const result = await rows<TableRow<T>>(
    db,
    `update public.${escapeIdentifier(table)} set ${assignments.join(", ")}
     where id = $${params.length + 1} returning *`,
    [...params, id],
  )
  return result[0]
}

/** Read one row by id as postgres-or-current role. */
export async function find<T extends TableName>(
  db: Db,
  table: T,
  id: string,
): Promise<TableRow<T> | undefined> {
  const result = await rows<TableRow<T>>(
    db,
    `select * from public.${escapeIdentifier(table)} where id = $1`,
    [id],
  )
  return result[0]
}

// ---------------------------------------------------------------------------
// Roles: who the database thinks is calling
// ---------------------------------------------------------------------------

async function setRequest(db: Db, claims: Row | null, headers: Row | null) {
  await db.query(
    "select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)",
    [claims ? JSON.stringify(claims) : "", headers ? JSON.stringify(headers) : ""],
  )
}

/** Back to plain `postgres` (bypasses RLS; the actor is "system"). */
export async function resetRole(db: Db): Promise<void> {
  await db.query("set local role none")
  await setRequest(db, null, null)
}

/** A signed-in user, as PostgREST runs a request with their JWT. */
export async function actAs(
  db: Db,
  authUserId: string,
  headers: Record<string, string> | null = null,
): Promise<void> {
  await resetRole(db)
  await setRequest(db, { sub: authUserId, role: "authenticated" }, headers)
  await db.query("set local role authenticated")
}

/** A signed-out visitor (the publishable key, no session). */
export async function actAsAnon(db: Db): Promise<void> {
  await resetRole(db)
  await setRequest(db, { role: "anon" }, null)
  await db.query("set local role anon")
}

/** The server (secret) key; `actorId` is sent as the x-actor-id header, as the bot API does. */
export async function actAsService(db: Db, actorId?: string): Promise<void> {
  await resetRole(db)
  await setRequest(db, { role: "service_role" }, actorId ? { "x-actor-id": actorId } : null)
  await db.query("set local role service_role")
}

// ---------------------------------------------------------------------------
// Fixtures. People, logins, bots, quarters and settings are created as
// postgres; the rest run as whatever role is current.
// ---------------------------------------------------------------------------

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8)
}

export async function createPerson(
  db: Db,
  opts: {
    name?: string
    email?: string
    role?: string
    sortOrder?: number
    isActive?: boolean
  } = {},
): Promise<TableRow<"people">> {
  const suffix = uniqueSuffix()
  return insert(db, "people", {
    name: opts.name ?? `Test Person ${suffix}`,
    role: opts.role ?? "Tester",
    email: opts.email ?? `db-test-${suffix}@example.test`,
    sort_order: opts.sortOrder ?? 900,
    is_active: opts.isActive ?? true,
  })
}

/**
 * A login. A confirmed one (the default, like `pnpm seed` creates) is linked by the
 * trigger to the person with the same email; an unconfirmed one is not.
 */
export async function createAuthUser(
  db: Db,
  email: string,
  { confirmed = true }: { confirmed?: boolean } = {},
): Promise<string> {
  return scalar<string>(
    db,
    `insert into auth.users (id, email, aud, role, email_confirmed_at)
     values (gen_random_uuid(), $1, 'authenticated', 'authenticated',
             case when $2 then now() end) returning id`,
    [email, confirmed],
  )
}

/** A person with a linked login. */
export async function createTeammate(
  db: Db,
  opts: Parameters<typeof createPerson>[1] = {},
): Promise<{ id: string; authUserId: string; person: TableRow<"people"> }> {
  const person = await createPerson(db, opts)
  const authUserId = await createAuthUser(db, person.email)
  return { id: person.id, authUserId, person: { ...person, auth_user_id: authUserId } }
}

/** A bot actor (like the Grok Chief of Staff). */
export async function createBot(
  db: Db,
  opts: { name?: string; isActive?: boolean } = {},
): Promise<string> {
  return scalar<string>(
    db,
    "insert into public.actors (kind, display_name, is_active) values ('bot', $1, $2) returning id",
    [opts.name ?? "Test Bot", opts.isActive ?? true],
  )
}

/** Any quarter (seeded ones are reused; otherwise one is created). */
export async function quarterId(db: Db): Promise<string> {
  const existing = await rows<{ id: string }>(
    db,
    "select id from public.quarters order by start_date limit 1",
  )
  if (existing[0]) return existing[0].id
  return scalar<string>(
    db,
    `insert into public.quarters (label, start_date, end_date, share_out_date)
     values ('Q1', '2026-10-14', '2027-01-13', '2026-12-09') returning id`,
  )
}

/** Set (or with null, remove) app_settings.automation_start_date. */
export async function setAutomationStartDate(db: Db, date: string | null): Promise<void> {
  if (date === null) {
    await db.query("delete from public.app_settings where key = 'automation_start_date'")
    return
  }
  await db.query(
    `insert into public.app_settings (key, value) values ('automation_start_date', to_jsonb($1::text))
     on conflict (key) do update set value = excluded.value`,
    [date],
  )
}

/** `count` Synthe6 week numbers no session uses yet. */
export async function freeWeekNumbers(db: Db, count: number): Promise<number[]> {
  const result = await rows<{ n: number }>(
    db,
    `select n from generate_series(1, 60) n
      where not exists (select 1 from public.synthe6_sessions s where s.week_number = n)
      order by n desc limit $1`,
    [count],
  )
  if (result.length < count) throw new Error("Not enough free Synthe6 week numbers")
  return result.map((r) => r.n)
}

export async function createOrg(
  db: Db,
  values: Insertable<"organizations"> & { owner_id: string },
): Promise<TableRow<"organizations">> {
  return insert(db, "organizations", {
    kind: "investor",
    name: `Test Org ${uniqueSuffix()}`,
    next_step: "Send the one-pager",
    next_step_date: sql("app.today_et() + 7"),
    ...values,
  })
}

export async function createTask(
  db: Db,
  values: Insertable<"tasks"> & { owner_id: string },
): Promise<TableRow<"tasks">> {
  return insert(db, "tasks", {
    title: `Test task ${uniqueSuffix()}`,
    next_action: "Draft the outline",
    due_date: sql("app.today_et() + 7"),
    ...values,
  })
}

export async function createOrgMeeting(
  db: Db,
  values: Insertable<"org_meetings"> & { organization_id: string; starts_at: string | Raw },
): Promise<TableRow<"org_meetings">> {
  return insert(db, "org_meetings", values)
}

export async function createObjective(
  db: Db,
  ownerId: string,
  quarter: string,
): Promise<TableRow<"objectives">> {
  return insert(db, "objectives", {
    quarter_id: quarter,
    title: `Test objective ${uniqueSuffix()}`,
    owner_id: ownerId,
  })
}

/** A Synthe6 session on a free start date (from 2000-01-01 on) and, unless a break, a free week. */
export async function createSession(
  db: Db,
  values: Insertable<"synthe6_sessions"> & { end_date: string | Raw },
): Promise<TableRow<"synthe6_sessions">> {
  const startDate = await scalar<string>(
    db,
    `select d::date::text from generate_series('2000-01-01'::date, '2000-12-31'::date, interval '1 day') d
      where not exists (select 1 from public.synthe6_sessions s where s.start_date = d::date)
      order by d limit 1`,
  )
  const isBreak = values.is_break === true
  const [week] = isBreak ? [null] : await freeWeekNumbers(db, 1)
  return insert(db, "synthe6_sessions", {
    start_date: startDate,
    week_number: week,
    week_label: week === null ? null : `W${week}`,
    format: "In person",
    activity_type: isBreak ? "Break" : "Workshop",
    ...values,
  })
}

/** The Sunday `weeksAgo` weeks before the last Sunday strictly before today (ET), as YYYY-MM-DD. */
export async function pastSunday(db: Db, weeksAgo = 0): Promise<string> {
  return scalar<string>(
    db,
    "select (app.today_et() - extract(isodow from app.today_et())::int - 7 * $1::int)::text",
    [weeksAgo],
  )
}

/**
 * Clean slate for rotation and workload tests: everyone already in the
 * database (the seeded team) becomes inactive, so only the test's people count.
 */
export async function deactivateEveryone(db: Db): Promise<void> {
  await db.query("update public.people set is_active = false where is_active")
}

/**
 * Run `fn` as postgres with triggers off, e.g. to backdate a row or to let time
 * "pass" for a meeting logged ahead of time. Nothing is audited meanwhile.
 * Afterwards the caller's role and request settings are restored.
 */
export async function withoutTriggers<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  const saved = await one<{ role: string; claims: string; headers: string }>(
    db,
    `select current_user as role,
            coalesce(current_setting('request.jwt.claims', true), '') as claims,
            coalesce(current_setting('request.headers', true), '') as headers`,
  )
  await resetRole(db)
  await db.query("set local session_replication_role = replica")
  try {
    return await fn()
  } finally {
    await db.query("set local session_replication_role = origin")
    await db.query(
      "select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)",
      [saved.claims, saved.headers],
    )
    await db.query(`set local role ${escapeIdentifier(saved.role)}`)
  }
}

/** True when two timestamptz values are the same moment (compared by Postgres). */
export async function sameMoment(db: Db, a: unknown, b: unknown): Promise<boolean> {
  return scalar<boolean>(db, "select $1::timestamptz = $2::timestamptz", [a, b])
}

/**
 * Make `app.today_et()` return `date` until the test's transaction rolls back,
 * to run rules that depend on the day (e.g. Sunday-only ones) on any day.
 * now() keeps the real time: with a `date` in the future it is still early
 * that day, and rows moved into the past (`now() - interval '3 hours'`) have
 * already started.
 */
export async function pretendToday(db: Db, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Not a YYYY-MM-DD date: ${date}`)
  await db.query(
    `create or replace function app.today_et() returns date
       language sql stable set search_path = ''
       as $$ select ${escapeLiteral(date)}::date $$`,
  )
}

/** An ET calendar day relative to today, as Postgres prints it (YYYY-MM-DD). */
export async function dayFromToday(db: Db, offset: number): Promise<string> {
  return scalar<string>(db, "select (app.today_et() + $1::int)::text", [offset])
}

/** The activity-log entries for one record, oldest first. */
export async function logFor(db: Db, entityId: string): Promise<TableRow<"activity_log">[]> {
  return rows<TableRow<"activity_log">>(
    db,
    "select * from public.activity_log where entity_id = $1 order by id",
    [entityId],
  )
}

/** The most recent activity-log entry for one record. */
export async function lastLogFor(db: Db, entityId: string): Promise<TableRow<"activity_log">> {
  return one<TableRow<"activity_log">>(
    db,
    "select * from public.activity_log where entity_id = $1 order by id desc limit 1",
    [entityId],
  )
}

/** Reverse one activity-log entry as the current role (`public.undo_activity`). */
export async function undo(db: Db, logId: number, force = false): Promise<void> {
  await db.query("select public.undo_activity($1, $2)", [logId, force])
}

/** Run the scheduled checks as pg_cron does (as postgres, actor "system"). */
export async function runScheduledChecks(
  db: Db,
): Promise<{ meetings_held: number; debriefs_created: number; events_queued: number }> {
  return scalar(db, "select app.run_scheduled_checks()")
}

/** JSON for a jsonb column (pg would otherwise send JS arrays as Postgres arrays). */
export function json(value: Json): string {
  return JSON.stringify(value)
}
