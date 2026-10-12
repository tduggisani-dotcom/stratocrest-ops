import { daysBetween, formatDate, formatTime, toEtDate, type IsoDate } from "@/lib/dates"
import {
  contactMethodLabels,
  hypothesisDecisionLabels,
  hypothesisStatusLabels,
  orgKindLabels,
  orgStageLabel,
  orgSubtypeLabels,
  testOutcomeLabels,
} from "@/lib/labels"
import { otherOrgKind } from "@/lib/schemas/organizations"
import type { Database } from "@/types/database"
import { kindConfig, type OrgKind } from "./kind-config"

/**
 * The org page's activity history: plain sentences for activity_log entries
 * about an org, its meetings and who went, its hypotheses and their tests, and
 * its debriefs ("Moved from Contacted to Meeting", "Logged a meeting on Oct 3").
 * Pure, so every sentence is unit-tested; queries/detail.ts loads the entries.
 */

type Enums = Database["public"]["Enums"]
type Row = Record<string, unknown>

/** Who made a change: a teammate, the Grok bot ("via Grok") or a scheduled job ("Automatic"). */
export type ActivityActor =
  | { kind: "person"; id: string; name: string; avatarUrl: string | null }
  | { kind: "bot"; name: string }
  | { kind: "system" }

/** One activity_log row, as the org page reads it. */
export type ActivityEntry = {
  id: number
  occurredAt: string
  /** insert | update | archive | restore | delete | undo */
  action: string
  /** The table name: organizations, org_meetings, org_meeting_attendees, hypotheses, … */
  entityType: string
  entityId: string
  before: Row | null
  after: Row | null
  changedFields: readonly string[] | null
  actor: ActivityActor
}

/** What the sentences need to name people, meetings and hypotheses. */
export type ActivityContext = {
  kind: OrgKind
  /** Every person (former teammates too): id → name. */
  people: ReadonlyMap<string, string>
  /** The org's meetings: id → starts_at. */
  meetings: ReadonlyMap<string, string>
  /** The org's hypotheses: id → statement. */
  hypotheses: ReadonlyMap<string, string>
}

export type ActivityLine = {
  id: number
  occurredAt: string
  actor: ActivityActor
  /** "Moved from Contacted to Meeting and changed the next step (due Oct 20)" */
  text: string
  /** The entry reverses an earlier change (someone pressed Undo). */
  undo: boolean
}

/** The actor as the log and the actors table describe it (no actor = a scheduled job). */
export function activityActor(
  actorKind: string,
  actor: {
    id: string
    kind: Enums["actor_kind"]
    display_name: string
    person: { name: string; avatar_url: string | null } | null
  } | null,
): ActivityActor {
  if (!actor || actorKind === "system") return { kind: "system" }
  if (actor.kind === "bot") return { kind: "bot", name: actor.display_name }
  return {
    kind: "person",
    id: actor.id,
    name: actor.person?.name ?? actor.display_name,
    avatarUrl: actor.person?.avatar_url ?? null,
  }
}

/** One sentence per entry, newest first as given. */
export function describeActivities(
  entries: readonly ActivityEntry[],
  context: ActivityContext,
): ActivityLine[] {
  return entries.map((entry) => ({
    id: entry.id,
    occurredAt: entry.occurredAt,
    actor: entry.actor,
    text: describeActivity(entry, context),
    undo: entry.action === "undo",
  }))
}

/** What happened, in one sentence. */
export function describeActivity(entry: ActivityEntry, context: ActivityContext): string {
  const effect = effectOf(entry)
  switch (entry.entityType) {
    case "organizations":
      return describeOrg(entry, effect, context)
    case "org_meetings":
      return describeMeeting(entry, effect, context)
    case "org_meeting_attendees":
      return describeAttendee(entry, effect, context)
    case "hypotheses":
      return describeHypothesis(entry, effect)
    case "hypothesis_tests":
      return describeTest(entry, effect, context)
    case "debriefs":
      return describeDebrief(entry, effect, context)
    default:
      return "Made a change"
  }
}

/**
 * "today, 3:04 PM", "yesterday, 9:15 AM", "3 days ago", "Oct 3", "Oct 3, 2025"
 * (ET). The exact moment goes in the <time> element's title.
 */
export function activityWhen(occurredAt: string, today: IsoDate): string {
  const day = toEtDate(occurredAt)
  const ago = daysBetween(day, today)
  if (ago <= 0) return `today, ${formatTime(occurredAt)}`
  if (ago === 1) return `yesterday, ${formatTime(occurredAt)}`
  if (ago < 7) return `${ago} days ago`
  const date = formatDate(day, "short")
  return day.slice(0, 4) === today.slice(0, 4) ? date : `${date}, ${day.slice(0, 4)}`
}

// ---------------------------------------------------------------------------

type Effect = "insert" | "update" | "archive" | "restore" | "delete"

/**
 * What the entry did to the row. An undo entry is described by its effect
 * (undoing an archive restores the record), and the line is marked as an undo.
 */
function effectOf(entry: ActivityEntry): Effect {
  if (entry.action !== "undo") {
    if (["insert", "update", "archive", "restore", "delete"].includes(entry.action)) {
      return entry.action as Effect
    }
  }
  if (!entry.before) return "insert"
  if (!entry.after) return "delete"
  const wasArchived = entry.before.archived_at != null
  const isArchived = entry.after.archived_at != null
  if (!wasArchived && isArchived) return "archive"
  if (wasArchived && !isArchived) return "restore"
  return "update"
}

/** The row's fields after the change (or before it, for a delete). */
function current(entry: ActivityEntry): Row {
  return entry.after ?? entry.before ?? {}
}

function text(row: Row | null, key: string): string | null {
  const value = row?.[key]
  return typeof value === "string" && value !== "" ? value : null
}

function num(row: Row | null, key: string): number | null {
  const value = row?.[key]
  return typeof value === "number" ? value : null
}

function changed(entry: ActivityEntry, ...fields: string[]): boolean {
  const list = entry.changedFields ?? []
  return fields.some((field) => list.includes(field))
}

/** "Oct 3" for a calendar day. */
function day(date: string | null): string | null {
  return date ? formatDate(date, "short") : null
}

/** "Oct 3" for a moment, as the ET calendar day. */
function meetingDay(startsAt: string | null): string | null {
  return startsAt ? formatDate(toEtDate(startsAt), "short") : null
}

/** “Contractors will pay $40 a helmet” (cut to fit one line). */
function quote(statement: string | null): string {
  if (!statement) return "a hypothesis"
  const clean = statement.replace(/\s+/g, " ").trim()
  return `“${clean.length > 80 ? `${clean.slice(0, 79).trimEnd()}…` : clean}”`
}

function personName(context: ActivityContext, id: string | null): string {
  return (id && context.people.get(id)) || "a former teammate"
}

/** "A, b and c": the first phrase starts the sentence; the rest continue it. */
function sentence(phrases: string[]): string {
  const parts = phrases.map((p, i) => (i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1)))
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

const CONTACT_FIELDS = ["contact_name", "contact_title", "contact_email", "contact_phone"]
const LOCATION_FIELDS = ["city", "state_or_country", "region"]
const HOW_WE_MET_FIELDS = ["first_contact_date", "first_contact_method", "introduced_by"]

function describeOrg(entry: ActivityEntry, effect: Effect, context: ActivityContext): string {
  const noun = orgKindLabels[context.kind].singular.toLowerCase()
  if (effect === "insert") {
    const stage = text(entry.after, "stage")
    return stage && stage !== "identified"
      ? `Added this ${noun} at ${orgStageLabel(context.kind, stage)}`
      : `Added this ${noun}`
  }
  if (effect === "archive") return `Archived this ${noun}`
  if (effect === "restore") return `Restored this ${noun}`
  if (effect === "delete") return `Deleted this ${noun}`

  const { before, after } = entry
  const phrases: string[] = []
  if (changed(entry, "stage")) {
    const from = text(before, "stage")
    const to = text(after, "stage")
    phrases.push(
      from && to
        ? `Moved from ${orgStageLabel(context.kind, from)} to ${orgStageLabel(context.kind, to)}`
        : `Moved to ${to ? orgStageLabel(context.kind, to) : "another stage"}`,
    )
  }
  if (changed(entry, "name")) phrases.push(`Renamed it ${text(after, "name") ?? ""}`.trim())
  if (changed(entry, "owner_id")) {
    phrases.push(`Made ${personName(context, text(after, "owner_id"))} the point of contact`)
  }
  if (changed(entry, "next_step")) {
    phrases.push(
      changed(entry, "next_step_date")
        ? `Changed the next step (due ${day(text(after, "next_step_date"))})`
        : "Changed the next step",
    )
  } else if (changed(entry, "next_step_date")) {
    phrases.push(`Moved the next step to ${day(text(after, "next_step_date"))}`)
  }
  if (changed(entry, "last_contact_date")) {
    const contact = text(after, "last_contact_date")
    phrases.push(contact ? `Noted contact on ${day(contact)}` : "Cleared the last contact date")
  }
  if (changed(entry, "subtype")) {
    const subtype = text(after, "subtype") as Enums["org_subtype"] | null
    phrases.push(subtype ? `Set the type to ${orgSubtypeLabels[subtype]}` : "Cleared the type")
  }
  if (changed(entry, ...CONTACT_FIELDS)) phrases.push("Updated the contact details")
  if (changed(entry, "link"))
    phrases.push(text(after, "link") ? "Updated the link" : "Removed the link")
  if (changed(entry, ...LOCATION_FIELDS)) phrases.push("Updated the location")
  if (changed(entry, ...HOW_WE_MET_FIELDS)) {
    const method = text(after, "first_contact_method") as Enums["contact_method"] | null
    phrases.push(
      changed(entry, "first_contact_method") && method
        ? `Noted how we met (${contactMethodLabels[method].toLowerCase()})`
        : "Updated how we met",
    )
  }
  if (changed(entry, "check_size_or_focus")) {
    phrases.push(`Updated the ${kindConfig(context.kind).focusLabel.toLowerCase()}`)
  }
  if (changed(entry, "notes")) phrases.push("Edited the notes")
  if (changed(entry, "key_result_id")) {
    phrases.push(text(after, "key_result_id") ? "Linked a key result" : "Unlinked the key result")
  }
  if (changed(entry, "related_organization_id")) {
    const other = orgKindLabels[otherOrgKind(context.kind)].singular.toLowerCase()
    phrases.push(
      text(after, "related_organization_id")
        ? `Linked the matching ${other}`
        : `Unlinked the matching ${other}`,
    )
  }
  return phrases.length > 0 ? sentence(phrases) : "Updated the details"
}

// ---------------------------------------------------------------------------
// Meetings and who went
// ---------------------------------------------------------------------------

function describeMeeting(entry: ActivityEntry, effect: Effect, context: ActivityContext): string {
  const row = current(entry)
  const when = meetingDay(text(row, "starts_at")) ?? "an unknown date"
  if (effect === "insert") {
    const startsAt = text(entry.after, "starts_at")
    // Logged after it happened, or scheduled ahead of time.
    if (startsAt && startsAt > entry.occurredAt) return `Scheduled a meeting for ${when}`
    const rating = num(entry.after, "rating")
    return rating ? `Logged a meeting on ${when}, rated ${rating}/5` : `Logged a meeting on ${when}`
  }
  if (effect === "delete") return `Removed the meeting on ${when}`

  const phrases: string[] = []
  const was = meetingDay(text(entry.before, "starts_at"))
  if (changed(entry, "starts_at")) {
    phrases.push(
      was && was !== when
        ? `Moved the meeting from ${was} to ${when}`
        : `Changed the time of the ${when} meeting`,
    )
  }
  if (changed(entry, "organization_id")) {
    phrases.push(`Moved the ${when} meeting to another record`)
  }
  if (changed(entry, "rating")) {
    const rating = num(entry.after, "rating")
    phrases.push(
      rating
        ? `Rated the ${when} meeting ${rating}/5`
        : `Cleared the rating of the ${when} meeting`,
    )
  }
  if (changed(entry, "follow_up_owner_id", "follow_up_date")) {
    const owner = text(entry.after, "follow_up_owner_id")
    const due = text(entry.after, "follow_up_date")
    phrases.push(
      owner && due
        ? `Set a follow-up for ${personName(context, owner)} by ${day(due)}`
        : "Cleared the follow-up",
    )
  }
  const other = (entry.changedFields ?? []).some(
    (f) =>
      !["starts_at", "organization_id", "rating", "follow_up_owner_id", "follow_up_date"].includes(
        f,
      ),
  )
  if (other || phrases.length === 0) phrases.push(`Updated the notes on the ${when} meeting`)
  return sentence(phrases)
}

function describeAttendee(entry: ActivityEntry, effect: Effect, context: ActivityContext): string {
  const row = current(entry)
  const name = personName(context, text(row, "person_id"))
  const startsAt = context.meetings.get(text(row, "org_meeting_id") ?? "") ?? null
  const meeting = startsAt ? `the ${meetingDay(startsAt)} meeting` : "a meeting"
  if (effect === "insert") return `Added ${name} to ${meeting}`
  if (effect === "delete") return `Removed ${name} from ${meeting}`
  return `Changed who went to ${meeting}`
}

// ---------------------------------------------------------------------------
// Hypotheses and their tests
// ---------------------------------------------------------------------------

function describeHypothesis(entry: ActivityEntry, effect: Effect): string {
  const statement = quote(text(current(entry), "statement"))
  if (effect === "insert") return `Added the hypothesis ${statement}`
  if (effect === "archive") return `Archived the hypothesis ${statement}`
  if (effect === "restore") return `Restored the hypothesis ${statement}`
  if (effect === "delete") return `Removed the hypothesis ${statement}`

  const phrases: string[] = []
  if (changed(entry, "status")) {
    const status = text(entry.after, "status") as Enums["hypothesis_status"] | null
    if (status) phrases.push(`Marked ${statement} ${hypothesisStatusLabels[status]}`)
  }
  if (changed(entry, "decision")) {
    const decision = text(entry.after, "decision") as Enums["hypothesis_decision"] | null
    phrases.push(
      decision
        ? `Decided to ${hypothesisDecisionLabels[decision].toLowerCase()} on ${statement}`
        : `Cleared the decision on ${statement}`,
    )
  }
  if (changed(entry, "organization_id")) phrases.push(`Moved ${statement} to another record`)
  const other = (entry.changedFields ?? []).some(
    (f) => !["status", "decision", "organization_id", "audience"].includes(f),
  )
  if (other || phrases.length === 0) phrases.push(`Updated the hypothesis ${statement}`)
  return sentence(phrases)
}

function describeTest(entry: ActivityEntry, effect: Effect, context: ActivityContext): string {
  const row = current(entry)
  const statement = quote(context.hypotheses.get(text(row, "hypothesis_id") ?? "") ?? null)
  if (effect === "delete") return `Removed evidence for ${statement}`
  const outcome = text(row, "outcome") as Enums["test_outcome"] | null
  const label = outcome ? `: ${testOutcomeLabels[outcome].toLowerCase()}` : ""
  return effect === "insert"
    ? `Recorded evidence for ${statement}${label}`
    : `Updated evidence for ${statement}${label}`
}

// ---------------------------------------------------------------------------
// Debriefs
// ---------------------------------------------------------------------------

function describeDebrief(entry: ActivityEntry, effect: Effect, context: ActivityContext): string {
  const row = current(entry)
  const startsAt = context.meetings.get(text(row, "org_meeting_id") ?? "") ?? null
  const meeting = startsAt ? `the ${meetingDay(startsAt)} meeting` : "a meeting"
  if (effect === "insert") return `Opened the debrief for ${meeting}`
  if (effect === "delete") return `Removed the debrief for ${meeting}`
  if (changed(entry, "status")) {
    return text(entry.after, "status") === "done"
      ? `Completed the debrief for ${meeting}`
      : `Reopened the debrief for ${meeting}`
  }
  if (changed(entry, "facilitator_id") && (entry.changedFields ?? []).length === 1) {
    return `Made ${personName(context, text(entry.after, "facilitator_id"))} the facilitator for ${meeting}`
  }
  return `Updated the debrief for ${meeting}`
}
