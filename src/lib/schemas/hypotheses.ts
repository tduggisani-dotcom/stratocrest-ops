import { z } from "zod"
import { isIsoDate } from "@/lib/dates"
import { HYPOTHESIS_DECISIONS, HYPOTHESIS_STATUSES, ORG_KINDS, TEST_OUTCOMES } from "@/lib/labels"
import { tooLongMessage } from "./organizations"
import { recordIdSchema } from "./people"

/**
 * Hypotheses and their evidence (spec §3 principle 2, §6.3 roll-up). One
 * source for the hypothesis forms, their Server Actions and the Stage 6 bot
 * API, so field names are the database column names.
 *
 * A hypothesis is about one investor or customer (`organization_id`; the
 * database copies its kind into `audience`), or about many of one kind
 * (`organization_id` empty, `audience` chosen by hand). Each test is one
 * conversation's evidence: a date, what it showed, and what we heard.
 *
 * Optional fields: a blank value becomes null (clears the column); a missing
 * key stays undefined (leave it as it is, or unset on create).
 */

/** Mirrors the CHECK constraints on public.hypotheses and public.hypothesis_tests. */
export const HYPOTHESIS_LIMITS = {
  statement: 1000,
  test_plan: 5000,
  success_criterion: 2000,
  result: 5000,
  learning: 5000,
  evidence: 5000,
} as const

export const HYPOTHESIS_MESSAGES = {
  statement: 'What do we believe? For example: "Site managers will pay for impact alerts".',
  audience: "Choose who this is about: investors or customers.",
  owner: "Choose a teammate from the list, or leave it empty.",
  organization:
    "That investor or customer isn't available any more. Choose again, or leave it empty.",
  status: "Choose Untested, Validated or Invalidated.",
  decision: "Choose Persevere, Pivot or Drop, or leave it empty.",
  hypothesis: "That hypothesis doesn't exist any more. Refresh to see the latest.",
  text: "Enter text here, or leave it empty.",
  testDate: "Pick the date of the conversation or test.",
  dateRange: "That date looks off. Check the year.",
  outcome: "Choose what the evidence showed: Supports, Contradicts or Inconclusive.",
  evidence:
    'What did we hear or see? For example: "Two site managers asked for a price per helmet".',
  meeting: "That meeting isn't available any more. Choose it again, or leave it empty.",
  test: "That evidence doesn't exist any more. Refresh to see the latest.",
} as const

// A date far outside anything plausible is almost always a typo ("0026-10-14").
const EARLIEST_DATE = "2000-01-01"
const LATEST_DATE = "2100-12-31"

/** "  " -> null, " x " -> "x"; anything else unchanged. */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Required text: trimmed, not blank, at most `max` characters. */
function requiredText(message: string, max: number) {
  return z.string({ error: message }).trim().min(1, message).max(max, tooLongMessage(max))
}

/** Optional text: blank -> null, missing -> undefined. */
function optionalText(max: number) {
  return z
    .preprocess(
      blankToNull,
      z.string({ error: HYPOTHESIS_MESSAGES.text }).max(max, tooLongMessage(max)).nullable(),
    )
    .optional()
}

/** Optional link to another record: blank -> null, missing -> undefined. */
function optionalId(message: string) {
  return z.preprocess(blankToNull, recordIdSchema(message).nullable()).optional()
}

/** Optional enum value: blank -> null, missing -> undefined. */
function optionalEnum<const V extends readonly [string, ...string[]]>(values: V, message: string) {
  return z.preprocess(blankToNull, z.enum(values, { error: message }).nullable()).optional()
}

export const hypothesisIdSchema = recordIdSchema(HYPOTHESIS_MESSAGES.hypothesis)
export const hypothesisTestIdSchema = recordIdSchema(HYPOTHESIS_MESSAGES.test)

export const hypothesisStatusValueSchema = z.enum(HYPOTHESIS_STATUSES, {
  error: HYPOTHESIS_MESSAGES.status,
})

/** "YYYY-MM-DD", a calendar day in America/New_York. */
const testDateSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string({ error: HYPOTHESIS_MESSAGES.testDate })
    .refine(isIsoDate, { error: HYPOTHESIS_MESSAGES.testDate, abort: true })
    .refine((d) => d >= EARLIEST_DATE && d <= LATEST_DATE, HYPOTHESIS_MESSAGES.dateRange),
)

/** Every field a person (or the bot) may set on a hypothesis. */
const hypothesisFields = {
  statement: requiredText(HYPOTHESIS_MESSAGES.statement, HYPOTHESIS_LIMITS.statement),
  test_plan: optionalText(HYPOTHESIS_LIMITS.test_plan),
  success_criterion: optionalText(HYPOTHESIS_LIMITS.success_criterion),
  owner_id: optionalId(HYPOTHESIS_MESSAGES.owner),
  /** The one investor or customer it's about; empty = across many of `audience`. */
  organization_id: optionalId(HYPOTHESIS_MESSAGES.organization),
  /** Investors or customers. Copied from the org by the database when one is linked. */
  audience: optionalEnum(ORG_KINDS, HYPOTHESIS_MESSAGES.audience),
  result: optionalText(HYPOTHESIS_LIMITS.result),
  learning: optionalText(HYPOTHESIS_LIMITS.learning),
  decision: optionalEnum(HYPOTHESIS_DECISIONS, HYPOTHESIS_MESSAGES.decision),
}

/**
 * "Who is it about?" is checked even while other fields have errors (Zod
 * skips object checks once a field fails), so the form shows every problem at
 * once. It waits only for the two fields it reads.
 */
const audienceRule = {
  error: HYPOTHESIS_MESSAGES.audience,
  path: ["audience"],
  when: (payload: { issues: readonly { path?: readonly PropertyKey[] }[] }) =>
    payload.issues.every((issue) => {
      const field = issue.path?.[0]
      return field !== "organization_id" && field !== "audience"
    }),
}

/**
 * New hypothesis. Status defaults to Untested. Without an org, say who it's
 * about (the roll-up splits investors from customers).
 */
export const hypothesisInputSchema = z
  .object({ ...hypothesisFields, status: hypothesisStatusValueSchema.default("untested") })
  .refine((h) => Boolean(h.organization_id || h.audience), audienceRule)

/**
 * The edit form (it sends every field but the status, which has its own
 * control) and the bot's update. A missing key is left as it is. Clearing the
 * org and the audience together would leave the roll-up nowhere to put it.
 */
export const hypothesisUpdateSchema = z
  .object({
    ...hypothesisFields,
    statement: hypothesisFields.statement.optional(),
    status: hypothesisStatusValueSchema.optional(),
    id: hypothesisIdSchema,
  })
  .refine((h) => !(h.organization_id === null && h.audience === null), audienceRule)

/** The status menu on the hypothesis page. */
export const hypothesisStatusUpdateSchema = z.object({
  id: hypothesisIdSchema,
  status: hypothesisStatusValueSchema,
})

const testFields = {
  test_date: testDateSchema,
  outcome: z.enum(TEST_OUTCOMES, { error: HYPOTHESIS_MESSAGES.outcome }),
  evidence: requiredText(HYPOTHESIS_MESSAGES.evidence, HYPOTHESIS_LIMITS.evidence),
  /** The investor or customer meeting the evidence came from (optional). */
  org_meeting_id: optionalId(HYPOTHESIS_MESSAGES.meeting),
}

/** New evidence for a hypothesis. */
export const hypothesisTestInputSchema = z.object({
  hypothesis_id: hypothesisIdSchema,
  ...testFields,
})

/** Correct a piece of evidence (tests are never deleted). It stays on its hypothesis. */
export const hypothesisTestUpdateSchema = z.object({ id: hypothesisTestIdSchema, ...testFields })

/** What the create schema accepts (status may be left out). */
export type HypothesisInputValues = z.input<typeof hypothesisInputSchema>
/** What it returns: ready to insert into public.hypotheses. */
export type HypothesisInput = z.output<typeof hypothesisInputSchema>
export type HypothesisUpdate = z.output<typeof hypothesisUpdateSchema>
export type HypothesisStatus = z.output<typeof hypothesisStatusValueSchema>
export type HypothesisTestInput = z.output<typeof hypothesisTestInputSchema>
export type HypothesisTestUpdate = z.output<typeof hypothesisTestUpdateSchema>

/** The hypothesis form's field names, in form order (also the keys refilled after an error). */
export const HYPOTHESIS_FORM_FIELDS = [
  "statement",
  "test_plan",
  "success_criterion",
  "owner_id",
  "organization_id",
  "audience",
  "result",
  "learning",
  "decision",
] as const satisfies readonly (keyof HypothesisUpdate)[]
export type HypothesisFormField = (typeof HYPOTHESIS_FORM_FIELDS)[number]

/** The evidence form's field names, in form order. */
export const HYPOTHESIS_TEST_FORM_FIELDS = [
  "test_date",
  "outcome",
  "evidence",
  "org_meeting_id",
] as const satisfies readonly (keyof HypothesisTestUpdate)[]
export type HypothesisTestFormField = (typeof HYPOTHESIS_TEST_FORM_FIELDS)[number]
