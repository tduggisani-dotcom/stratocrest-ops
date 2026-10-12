import { z } from "zod"
import { etMoment, isIsoDate } from "@/lib/dates"
import { ORG_LIMITS, ORG_MESSAGES, tooLongMessage } from "./organizations"
import { recordIdSchema } from "./people"

/**
 * Investor and customer meetings (spec §6.2: "Logging a meeting takes ≤ 2
 * screens"). One source for the meeting form, its Server Actions and (in
 * Stage 6) the bot API, so field names are the database column names, plus
 * two form-only ones: `meeting_date` and `meeting_time` (ET wall clock), which
 * become `starts_at`.
 *
 * The database checks the same rules (CHECK constraints and
 * public.log_org_meeting / update_org_meeting); these messages are what a
 * person sees first.
 *
 * - Who went from our side: at least one teammate.
 * - A rating (1–5) only once the meeting has happened, and with a one-line
 *   summary (the tracker table shows both).
 * - Follow-up: who and by when, both or neither.
 * - The org's next step can be updated in the same step; leave both fields out
 *   to keep it as it is.
 */

/** Mirrors the CHECK constraints on public.org_meetings. */
export const ORG_MEETING_LIMITS = {
  external_attendees: 500,
  summary: 200,
  notes: 20_000,
  concerns_raised: 5_000,
  materials_requested: 5_000,
} as const

export const ORG_MEETING_MESSAGES = {
  date: "Pick the day of the meeting.",
  dateRange: "That date looks off. Check the year.",
  time: "Pick a time, like 2:30 PM.",
  attendees: "Who went from our side? Pick at least one teammate.",
  rating: "Choose a rating from 1 to 5, or leave it empty.",
  futureRating: "Rate it after it happens.",
  summary: "One line: how did it go?",
  followUp: "Pick who follows up and by when.",
  followUpDate: "Pick a follow-up date.",
  nextStep: ORG_MESSAGES.nextStep,
  nextStepDate: ORG_MESSAGES.nextStepDate,
  text: "Enter text here, or leave it empty.",
  org: "That investor or customer doesn't exist any more. Refresh to see the latest.",
  meeting: "That meeting doesn't exist any more. Refresh to see the latest.",
} as const

// A date far outside anything plausible is almost always a typo ("0026-10-14").
const EARLIEST_DATE = "2000-01-01"
const LATEST_DATE = "2100-12-31"

/** "HH:MM" (24-hour, as <input type="time"> sends it); seconds, if any, are dropped. */
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d(\.\d+)?)?$/

/** "  " and missing -> null, " x " -> "x"; anything else unchanged. */
function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function trimmed(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value
}

function dateSchema(message: string) {
  return z
    .string({ error: message })
    .refine(isIsoDate, { error: message, abort: true })
    .refine((d) => d >= EARLIEST_DATE && d <= LATEST_DATE, ORG_MEETING_MESSAGES.dateRange)
}

/** Optional text: blank or missing -> null. */
function optionalText(max: number) {
  return z.preprocess(
    blankToNull,
    z.string({ error: ORG_MEETING_MESSAGES.text }).max(max, tooLongMessage(max)).nullable(),
  )
}

/** "1".."5" (a form) or 1..5 (the API); blank or missing -> null. */
const ratingSchema = z.preprocess(
  (value) => {
    const v = blankToNull(value)
    return typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v
  },
  z
    .number({ error: ORG_MEETING_MESSAGES.rating })
    .int(ORG_MEETING_MESSAGES.rating)
    .min(1, ORG_MEETING_MESSAGES.rating)
    .max(5, ORG_MEETING_MESSAGES.rating)
    .nullable(),
)

/** One id (a single checkbox) or many; repeats are dropped. */
const attendeesSchema = z.preprocess(
  (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]),
  z
    .array(recordIdSchema(ORG_MEETING_MESSAGES.attendees), {
      error: ORG_MEETING_MESSAGES.attendees,
    })
    .min(1, ORG_MEETING_MESSAGES.attendees)
    .transform((ids) => [...new Set(ids.map((id) => id.toLowerCase()))]),
)

const fields = {
  meeting_date: z.preprocess(trimmed, dateSchema(ORG_MEETING_MESSAGES.date)),
  meeting_time: z.preprocess(
    trimmed,
    z
      .string({ error: ORG_MEETING_MESSAGES.time })
      .regex(TIME, ORG_MEETING_MESSAGES.time)
      .transform((t) => t.slice(0, 5)),
  ),
  /** Our side (people ids). */
  attendee_ids: attendeesSchema,
  /** Their side, free text. */
  external_attendees: optionalText(ORG_MEETING_LIMITS.external_attendees),
  rating: ratingSchema,
  /** The one-liner in the tracker table. */
  summary: optionalText(ORG_MEETING_LIMITS.summary),
  notes: optionalText(ORG_MEETING_LIMITS.notes),
  concerns_raised: optionalText(ORG_MEETING_LIMITS.concerns_raised),
  materials_requested: optionalText(ORG_MEETING_LIMITS.materials_requested),
  follow_up_owner_id: z.preprocess(
    blankToNull,
    recordIdSchema(ORG_MEETING_MESSAGES.followUp).nullable(),
  ),
  follow_up_date: z.preprocess(
    blankToNull,
    dateSchema(ORG_MEETING_MESSAGES.followUpDate).nullable(),
  ),
  /** The org's next step, when the meeting changed it (with next_step_date; both or neither). */
  next_step: z.preprocess(
    trimmed,
    z
      .string({ error: ORG_MEETING_MESSAGES.nextStep })
      .min(1, ORG_MEETING_MESSAGES.nextStep)
      .max(ORG_LIMITS.next_step, tooLongMessage(ORG_LIMITS.next_step))
      .optional(),
  ),
  next_step_date: z.preprocess(trimmed, dateSchema(ORG_MEETING_MESSAGES.nextStepDate).optional()),
}

type MeetingFields = z.output<z.ZodObject<typeof fields>>

/** The checks that span fields, and the date + time -> starts_at step. */
function finish<T extends MeetingFields>(now: () => Date) {
  return (meeting: T, ctx: z.RefinementCtx) => {
    const startsAt = etMoment(meeting.meeting_date, meeting.meeting_time)

    if (meeting.rating !== null && startsAt.getTime() > now().getTime()) {
      ctx.addIssue({ code: "custom", path: ["rating"], message: ORG_MEETING_MESSAGES.futureRating })
    }
    if (meeting.rating !== null && meeting.summary === null) {
      ctx.addIssue({ code: "custom", path: ["summary"], message: ORG_MEETING_MESSAGES.summary })
    }
    if ((meeting.follow_up_owner_id === null) !== (meeting.follow_up_date === null)) {
      ctx.addIssue({
        code: "custom",
        path: [meeting.follow_up_owner_id === null ? "follow_up_owner_id" : "follow_up_date"],
        message: ORG_MEETING_MESSAGES.followUp,
      })
    }
    if ((meeting.next_step === undefined) !== (meeting.next_step_date === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [meeting.next_step === undefined ? "next_step" : "next_step_date"],
        message:
          meeting.next_step === undefined
            ? ORG_MEETING_MESSAGES.nextStep
            : ORG_MEETING_MESSAGES.nextStepDate,
      })
    }
    if (ctx.issues.length > 0) return z.NEVER

    const { meeting_date: _date, meeting_time: _time, ...rest } = meeting
    return { ...rest, starts_at: startsAt.toISOString() }
  }
}

/**
 * Log a meeting (screen 1). `now` decides whether the meeting has happened
 * (a rating is only allowed then); pass it in tests.
 */
export function orgMeetingCreateSchema(now: () => Date = () => new Date()) {
  return z
    .object({ ...fields, organization_id: recordIdSchema(ORG_MEETING_MESSAGES.org) })
    .transform(finish(now))
}

/** Edit a meeting: every field is replaced (the form sends them all). */
export function orgMeetingUpdateSchema(now: () => Date = () => new Date()) {
  return z
    .object({ ...fields, id: recordIdSchema(ORG_MEETING_MESSAGES.meeting) })
    .transform(finish(now))
}

export const orgMeetingIdSchema = recordIdSchema(ORG_MEETING_MESSAGES.meeting)

/** Ready to send to public.log_org_meeting (`starts_at` is an ISO timestamp). */
export type OrgMeetingCreate = z.output<ReturnType<typeof orgMeetingCreateSchema>>
export type OrgMeetingUpdate = z.output<ReturnType<typeof orgMeetingUpdateSchema>>

/** The meeting form's field names, in form order (also the keys refilled after an error). */
export const ORG_MEETING_FORM_FIELDS = [
  "meeting_date",
  "meeting_time",
  "attendee_ids",
  "external_attendees",
  "rating",
  "summary",
  "notes",
  "concerns_raised",
  "materials_requested",
  "follow_up_owner_id",
  "follow_up_date",
  "next_step",
  "next_step_date",
] as const
export type OrgMeetingFormField = (typeof ORG_MEETING_FORM_FIELDS)[number]
