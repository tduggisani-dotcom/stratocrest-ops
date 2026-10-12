import { z } from "zod"
import { MAX_STRENGTHS, canonicalStrength, type CliftonStrength } from "@/lib/clifton-strengths"
import { isIsoDate } from "@/lib/dates"
import { AVAILABILITY_LABELS } from "@/lib/labels"

/**
 * People: profile fields, weekly availability blocks and crunch periods.
 * Field names are the database column names, so the same schemas serve the
 * forms, the Server Actions and (Stage 6) the bot API.
 *
 * Optional text: a blank value becomes null (clears the column); a missing key
 * stays undefined (leave it as it is), which is what a bot's partial update needs.
 */

export const PEOPLE_LIMITS = {
  name: 120,
  role: 120,
  avatarUrl: 2048,
  contactPreference: 500,
  strengths: MAX_STRENGTHS,
  skills: 30,
  skill: 60,
  availabilityNote: 200,
  crunchLabel: 120,
} as const

/** Form field names for the five ranked strength pickers: strength_1 … strength_5. */
export const STRENGTH_FIELDS = Array.from(
  { length: MAX_STRENGTHS },
  (_, i) => `strength_${i + 1}`,
) as readonly string[]

export const AVATAR_URL_MESSAGE = "Use an image link that starts with https://"
export const END_TIME_MESSAGE = "The end time must be after the start time."
export const END_DATE_MESSAGE = "The end date can't be before the start date."

/** "  " -> null, " x " -> "x"; anything else unchanged. */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Required text: trimmed, not blank, at most `max` characters. */
function requiredText(blankMessage: string, max: number) {
  return z
    .string({ error: blankMessage })
    .trim()
    .min(1, blankMessage)
    .max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`)
}

/** Optional text: blank -> null, missing -> undefined. */
function optionalText(max: number) {
  return z
    .preprocess(
      blankToNull,
      z
        .string({ error: "Enter text here, or leave it empty." })
        .max(max, `Use ${max.toLocaleString("en-US")} characters or fewer.`)
        .nullable(),
    )
    .optional()
}

/**
 * A record id. Postgres accepts any 8-4-4-4-12 hex id (not only RFC 4122 v4),
 * so this is `guid`, not the stricter `uuid`.
 */
export function recordIdSchema(message: string) {
  return z.guid({ error: message })
}

export const personIdSchema = recordIdSchema("Choose a teammate.")

/** True when `value` can be a person id (anything else is a 404, not a database error). */
export function isRecordId(value: unknown): value is string {
  return recordIdSchema("").safeParse(value).success
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function isHttpsUrl(value: string): boolean {
  if (!value.startsWith("https://") || !URL.canParse(value)) return false
  return new URL(value).hostname !== ""
}

const avatarUrlSchema = z
  .preprocess(
    blankToNull,
    z
      .string({ error: AVATAR_URL_MESSAGE })
      .max(PEOPLE_LIMITS.avatarUrl, "That link is too long. Use one under 2,048 characters.")
      .refine(isHttpsUrl, AVATAR_URL_MESSAGE)
      .nullable(),
  )
  .optional()

/** One string (one picker) or a list; null/undefined entries count as empty pickers. */
function toStringList(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return []
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.map((item) => (item == null ? "" : item))
  return value
}

/**
 * CliftonStrengths top 5, in rank order. Takes the five pickers as given (blank
 * ones allowed, so an error can point at the right picker: path `strengths.<i>`),
 * accepts any letter case, and outputs canonical names with the blanks removed.
 */
const strengthsSchema = z
  .preprocess(
    toStringList,
    z
      .array(z.string({ error: "Pick a strength from the list." }), {
        error: "Pick strengths from the list.",
      })
      .superRefine((values, ctx) => {
        const picked = values.filter((v) => v.trim() !== "")
        if (picked.length > MAX_STRENGTHS) {
          ctx.addIssue({
            code: "custom",
            message: `Pick at most ${MAX_STRENGTHS} strengths.`,
          })
        }
        const seen = new Set<CliftonStrength>()
        values.forEach((value, index) => {
          if (value.trim() === "") return
          const name = canonicalStrength(value)
          if (!name) {
            ctx.addIssue({
              code: "custom",
              message: "Pick a strength from the list.",
              path: [index],
            })
          } else if (seen.has(name)) {
            ctx.addIssue({
              code: "custom",
              message: `${name} is already picked. Choose a different strength, or leave this one empty.`,
              path: [index],
            })
          } else {
            seen.add(name)
          }
        })
      })
      .transform((values) =>
        values.map(canonicalStrength).filter((name): name is CliftonStrength => name !== null),
      ),
  )
  .optional()

/**
 * Skills: comma-separated text ("CAD, grant writing") or a list. Items are
 * trimmed; blanks and repeats (ignoring case; the first spelling wins) are dropped.
 */
export function parseSkills(value: string | readonly string[]): string[] {
  const items = typeof value === "string" ? value.split(/[,\n]/) : value
  const seen = new Set<string>()
  const skills: string[] = []
  for (const item of items) {
    const skill = item.trim().replace(/\s+/g, " ")
    const key = skill.toLowerCase()
    if (skill === "" || seen.has(key)) continue
    seen.add(key)
    skills.push(skill)
  }
  return skills
}

const skillsSchema = z
  .preprocess(
    (value) => (value === null ? [] : value),
    z
      .union([z.string(), z.array(z.string())], {
        error: "List skills separated by commas.",
      })
      .transform((value) => parseSkills(value))
      .superRefine((skills, ctx) => {
        const tooLong = skills.find((s) => s.length > PEOPLE_LIMITS.skill)
        if (tooLong) {
          ctx.addIssue({
            code: "custom",
            message: `Keep each skill to ${PEOPLE_LIMITS.skill} characters or fewer ("${tooLong.slice(0, 24)}…" is longer).`,
          })
        }
        if (skills.length > PEOPLE_LIMITS.skills) {
          ctx.addIssue({
            code: "custom",
            message: `List at most ${PEOPLE_LIMITS.skills} skills (this has ${skills.length}).`,
          })
        }
      }),
  )
  .optional()

/** The profile fields a teammate can edit (spec §2: everyone can edit everyone's). */
export const profileSchema = z.object({
  name: requiredText("Enter a name.", PEOPLE_LIMITS.name),
  role: requiredText("Enter a role, like CFO or R&D Lead.", PEOPLE_LIMITS.role),
  avatar_url: avatarUrlSchema,
  contact_preference: optionalText(PEOPLE_LIMITS.contactPreference),
  strengths: strengthsSchema,
  skills: skillsSchema,
})

export type ProfileInput = z.input<typeof profileSchema>
export type ProfileUpdate = z.output<typeof profileSchema>

/** The profile form's fields as schema input (the five pickers become `strengths`). */
export function profileFormInput(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get("name"),
    role: formData.get("role"),
    avatar_url: formData.get("avatar_url"),
    contact_preference: formData.get("contact_preference"),
    strengths: STRENGTH_FIELDS.map((field) => formData.get(field) ?? ""),
    skills: formData.get("skills"),
  }
}

/**
 * The profile form field for a schema error key, so focus can move to it:
 * "strengths.2" is the 3rd picker (strength_3); a list-wide "strengths" error
 * goes to the 1st.
 */
export function profileFieldName(errorKey: string): string {
  const match = /^strengths\.(\d+)$/.exec(errorKey)
  if (match) return STRENGTH_FIELDS[Number(match[1])] ?? STRENGTH_FIELDS[0]!
  if (errorKey === "strengths") return STRENGTH_FIELDS[0]!
  return errorKey
}

// ---------------------------------------------------------------------------
// Availability blocks (weekly, ET wall clock)
// ---------------------------------------------------------------------------

/** "09:00" or "09:00:00" (what Postgres returns); stored and compared as "HH:MM". */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function clockTime(blankMessage: string) {
  return z
    .string({ error: blankMessage })
    .trim()
    .min(1, blankMessage)
    .regex(CLOCK_TIME, "Enter a time like 9:00 AM.")
    .transform((value) => value.slice(0, 5))
}

function hasIssueAt(issues: readonly { path?: readonly PropertyKey[] }[], keys: string[]) {
  return issues.some((issue) => keys.includes(String(issue.path?.[0])))
}

export const availabilityBlockSchema = z
  .object({
    person_id: personIdSchema,
    weekday: z.coerce
      .number({ error: "Choose a day of the week." })
      .int("Choose a day of the week.")
      .min(1, "Choose a day of the week.")
      .max(7, "Choose a day of the week."),
    start_time: clockTime("Enter a start time."),
    end_time: clockTime("Enter an end time."),
    label: z.enum(AVAILABILITY_LABELS, { error: "Choose class, work, or other." }),
    note: optionalText(PEOPLE_LIMITS.availabilityNote),
  })
  .refine((block) => block.end_time > block.start_time, {
    path: ["end_time"],
    message: END_TIME_MESSAGE,
    // Also check while other fields have errors, so every problem shows at once.
    when: (payload) => !hasIssueAt(payload.issues, ["start_time", "end_time"]),
  })

export type AvailabilityBlockInput = z.output<typeof availabilityBlockSchema>

// ---------------------------------------------------------------------------
// Crunch periods (finals, a deadline at work…): tasks due inside one get a warning
// ---------------------------------------------------------------------------

function isoDay(blankMessage: string) {
  return z
    .string({ error: blankMessage })
    .trim()
    .min(1, blankMessage)
    .refine((value) => isIsoDate(value), "Enter a date like 2026-12-07.")
}

export const crunchPeriodSchema = z
  .object({
    person_id: personIdSchema,
    label: requiredText("Name the crunch period, like Finals.", PEOPLE_LIMITS.crunchLabel),
    start_date: isoDay("Enter the first day."),
    end_date: isoDay("Enter the last day."),
  })
  .refine((period) => period.end_date >= period.start_date, {
    path: ["end_date"],
    message: END_DATE_MESSAGE,
    when: (payload) => !hasIssueAt(payload.issues, ["start_date", "end_date"]),
  })

export type CrunchPeriodInput = z.output<typeof crunchPeriodSchema>

// ---------------------------------------------------------------------------
// Removing (availability blocks and crunch periods are hard-deleted; RLS allows it)
// ---------------------------------------------------------------------------

const GONE_MESSAGE = "That item no longer exists. Refresh and try again."

export const removeAvailabilityBlockSchema = z.object({ id: recordIdSchema(GONE_MESSAGE) })
export const removeCrunchPeriodSchema = z.object({ id: recordIdSchema(GONE_MESSAGE) })
