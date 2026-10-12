import { z } from "zod"
import { DEBRIEF_STATUSES } from "@/lib/labels"
import { tooLongMessage } from "./organizations"
import { recordIdSchema } from "./people"

/**
 * Debriefs (spec §6.7): one template for every kind (Synthe6 session, mentor
 * coaching, investor or customer meeting, Sunday meeting). One source for the
 * debrief form, its Server Action and (in Stage 6) the bot API, so field names
 * are the database column names.
 *
 * The database creates each debrief (status due); people fill it in. Blank
 * answers become null (cleared); a missing key leaves that answer as it is.
 * Marking a debrief done needs at least one answer. Action items → tasks come
 * in Stage 4.
 */

/** The template's four questions, in order (the column names). */
export const DEBRIEF_ANSWER_FIELDS = ["planned", "actual", "worked", "change"] as const
export type DebriefAnswerField = (typeof DEBRIEF_ANSWER_FIELDS)[number]

/** Mirrors the CHECK constraints on public.debriefs. */
export const DEBRIEF_LIMITS = {
  planned: 10_000,
  actual: 10_000,
  worked: 10_000,
  change: 10_000,
} as const satisfies Record<DebriefAnswerField, number>

export const DEBRIEF_MESSAGES = {
  debrief: "That debrief doesn't exist any more. Refresh to see the latest.",
  facilitator: "Choose a teammate from the list, or leave it empty.",
  status: "Choose due or done.",
  emptyDone: "Write at least one answer before marking the debrief done.",
  text: "Enter text here, or leave it empty.",
} as const

/** "  " -> null, " x " -> "x"; missing stays undefined (leave as is). */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function answerSchema(field: DebriefAnswerField) {
  const max = DEBRIEF_LIMITS[field]
  return z
    .preprocess(
      blankToNull,
      z.string({ error: DEBRIEF_MESSAGES.text }).max(max, tooLongMessage(max)).nullable(),
    )
    .optional()
}

/**
 * Save a debrief: any of the four answers, the facilitator, and optionally its
 * status ("done" marks it done, "due" reopens it; missing keeps it).
 */
export const debriefUpdateSchema = z
  .object({
    id: recordIdSchema(DEBRIEF_MESSAGES.debrief),
    planned: answerSchema("planned"),
    actual: answerSchema("actual"),
    worked: answerSchema("worked"),
    change: answerSchema("change"),
    facilitator_id: z
      .preprocess(blankToNull, recordIdSchema(DEBRIEF_MESSAGES.facilitator).nullable())
      .optional(),
    status: z.enum(DEBRIEF_STATUSES, { error: DEBRIEF_MESSAGES.status }).optional(),
  })
  .superRefine((debrief, ctx) => {
    // Done with nothing written isn't a debrief. (Answers left out of the
    // request are checked against what's stored by the action.)
    const sent = DEBRIEF_ANSWER_FIELDS.filter((f) => debrief[f] !== undefined)
    if (
      debrief.status === "done" &&
      sent.length === DEBRIEF_ANSWER_FIELDS.length &&
      sent.every((f) => debrief[f] === null)
    ) {
      ctx.addIssue({ code: "custom", path: ["planned"], message: DEBRIEF_MESSAGES.emptyDone })
    }
  })

export type DebriefUpdate = z.output<typeof debriefUpdateSchema>

/** The debrief form's field names, in form order (also the keys refilled after an error). */
export const DEBRIEF_FORM_FIELDS = [...DEBRIEF_ANSWER_FIELDS, "facilitator_id"] as const
export type DebriefFormField = (typeof DEBRIEF_FORM_FIELDS)[number]
