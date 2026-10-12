import { z } from "zod"
import { isIsoDate } from "@/lib/dates"
import {
  CONTACT_METHODS,
  ORG_KINDS,
  ORG_REGIONS,
  orgKindLabels,
  orgStagesByKind,
  orgSubtypesByKind,
} from "@/lib/labels"
import type { Database } from "@/types/database"
import { recordIdSchema } from "./people"

/**
 * Investors and customers (spec §6.2–6.3): one schema per kind, built by one
 * factory, so the stages and subtypes a form or the bot may use are the ones
 * the database allows for that kind. Field names are the database column names
 * (the same schemas serve the org form, its Server Actions and the Stage 6 bot API).
 *
 * Implementation intentions (principle 5): every org has ONE owner (the "Coatl
 * point of contact"), a concrete next step and a date. The database enforces the
 * same rules (NOT NULL + CHECK); these messages are what a person sees first.
 *
 * Optional fields: a blank value becomes null (clears the column); a missing key
 * stays undefined (leave it as it is, or unset on create).
 */

type OrgKind = Database["public"]["Enums"]["org_kind"]
type OrgSubtype = Database["public"]["Enums"]["org_subtype"]

/** Mirrors the CHECK constraints on public.organizations. */
export const ORG_LIMITS = {
  name: 200,
  next_step: 500,
  contact_name: 200,
  contact_title: 200,
  contact_email: 254,
  contact_phone: 40,
  link: 2048,
  city: 120,
  state_or_country: 120,
  introduced_by: 200,
  check_size_or_focus: 500,
  notes: 20_000,
} as const

export const ORG_MESSAGES = {
  owner: "Choose the Coatl point of contact.",
  nextStep: 'What\'s the very next step? For example: "Send the deck to Jane".',
  nextStepDate: "Pick a date for the next step.",
  date: "Pick a date, or leave it empty.",
  dateRange: "That date looks off. Check the year.",
  email: "Enter an email address like jane@example.com, or leave it empty.",
  link: "Use a link that starts with https://",
  region: "Choose a region from the list.",
  firstContactMethod: "Choose how we first got in touch.",
  keyResult: "That key result isn't available any more. Choose it again.",
  text: "Enter text here, or leave it empty.",
} as const

/** "Use 200 characters or fewer." */
export function tooLongMessage(max: number): string {
  return `Use ${max.toLocaleString("en-US")} characters or fewer.`
}

/** "an investor" / "a customer". */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`
}

/** The kind that isn't `kind`: an investor's related org is a customer and vice versa. */
export function otherOrgKind(kind: OrgKind): OrgKind {
  return ORG_KINDS.find((k) => k !== kind) ?? kind
}

/** Messages that name the kind ("Enter the investor's name."). */
export function orgKindMessages(kind: OrgKind) {
  const noun = orgKindLabels[kind].singular.toLowerCase()
  const other = orgKindLabels[otherOrgKind(kind)].singular.toLowerCase()
  return {
    name: `Enter the ${noun}'s name.`,
    stage: `Choose one of the ${noun} stages.`,
    subtype: `Choose one of the ${noun} types, or leave it empty.`,
    org: `That ${noun} doesn't exist any more. Refresh to see the latest.`,
    archived: `This ${noun} is archived. Restore it from its page to edit it.`,
    relatedOrg: `Choose ${withArticle(other)} from the list, or leave it empty.`,
    duplicate: (name: string) => `There's already ${withArticle(noun)} called ${name}.`,
  }
}

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
      z.string({ error: ORG_MESSAGES.text }).max(max, tooLongMessage(max)).nullable(),
    )
    .optional()
}

/** "YYYY-MM-DD", a calendar day in America/New_York. */
function dateSchema(message: string) {
  return z
    .string({ error: message })
    .refine(isIsoDate, { error: message, abort: true })
    .refine((d) => d >= EARLIEST_DATE && d <= LATEST_DATE, ORG_MESSAGES.dateRange)
}

/** Optional calendar day: blank -> null, missing -> undefined. */
const optionalDateSchema = z
  .preprocess(blankToNull, dateSchema(ORG_MESSAGES.date).nullable())
  .optional()

/** Optional enum value: blank -> null, missing -> undefined. */
function optionalEnum<const V extends readonly [string, ...string[]]>(values: V, message: string) {
  return z.preprocess(blankToNull, z.enum(values, { error: message }).nullable()).optional()
}

/** Optional link to another record: blank -> null, missing -> undefined. */
function optionalId(message: string) {
  return z.preprocess(blankToNull, recordIdSchema(message).nullable()).optional()
}

/**
 * "acme.com" -> "https://acme.com": typing the scheme is a chore on a phone.
 * Anything that already names a scheme (http:, mailto:, javascript:) is left
 * alone for the check below to judge.
 */
export function withHttps(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed === "" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return /^[^\s/.]+(\.[^\s/.]+)+(\/\S*)?$/.test(trimmed) ? `https://${trimmed}` : trimmed
}

/** http(s) only: the link is rendered as an href, so nothing else may get through. */
function isWebLink(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) return false
  return new URL(value).hostname !== ""
}

const linkSchema = z
  .preprocess(
    (value) => blankToNull(withHttps(value)),
    z
      .string({ error: ORG_MESSAGES.link })
      .max(ORG_LIMITS.link, "That link is too long. Use one under 2,048 characters.")
      .refine(isWebLink, ORG_MESSAGES.link)
      .nullable(),
  )
  .optional()

const emailSchema = z
  .preprocess(
    blankToNull,
    z
      .email({ error: ORG_MESSAGES.email })
      .max(ORG_LIMITS.contact_email, tooLongMessage(ORG_LIMITS.contact_email))
      .nullable(),
  )
  .optional()

/** Fields shared by both kinds. Stage, subtype and the related org are added per kind. */
const commonFields = {
  owner_id: recordIdSchema(ORG_MESSAGES.owner),
  next_step: requiredText(ORG_MESSAGES.nextStep, ORG_LIMITS.next_step),
  next_step_date: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    dateSchema(ORG_MESSAGES.nextStepDate),
  ),
  contact_name: optionalText(ORG_LIMITS.contact_name),
  contact_title: optionalText(ORG_LIMITS.contact_title),
  contact_email: emailSchema,
  contact_phone: optionalText(ORG_LIMITS.contact_phone),
  link: linkSchema,
  city: optionalText(ORG_LIMITS.city),
  state_or_country: optionalText(ORG_LIMITS.state_or_country),
  region: optionalEnum(ORG_REGIONS, ORG_MESSAGES.region),
  first_contact_date: optionalDateSchema,
  first_contact_method: optionalEnum(CONTACT_METHODS, ORG_MESSAGES.firstContactMethod),
  introduced_by: optionalText(ORG_LIMITS.introduced_by),
  check_size_or_focus: optionalText(ORG_LIMITS.check_size_or_focus),
  /** Contact OUTSIDE logged meetings (an email, a call), entered by hand. */
  last_contact_date: optionalDateSchema,
  notes: optionalText(ORG_LIMITS.notes),
  key_result_id: optionalId(ORG_MESSAGES.keyResult),
}

function buildSchemas(kind: OrgKind) {
  const messages = orgKindMessages(kind)
  const stages = orgStagesByKind[kind].map((s) => s.value) as unknown as readonly [
    string,
    ...string[],
  ]
  const subtypes = orgSubtypesByKind[kind] as readonly OrgSubtype[] as readonly [
    OrgSubtype,
    ...OrgSubtype[],
  ]
  const stage = z.enum(stages, { error: messages.stage })
  const fields = {
    name: requiredText(messages.name, ORG_LIMITS.name),
    subtype: optionalEnum(subtypes, messages.subtype),
    ...commonFields,
    /** The same company tracked as the other kind. The action checks it really is one. */
    related_organization_id: optionalId(messages.relatedOrg),
  }

  /** Create: stage defaults to the first stage ("identified"). */
  const create = z.object({ ...fields, stage: stage.default("identified") })

  /**
   * The edit form (it sends every field) and the bot's update. A missing stage
   * is left as it is; the stage control and the board use changeOrgStage.
   */
  const update = z
    .object({ ...fields, stage: stage.optional(), id: recordIdSchema(messages.org) })
    .refine((org) => org.related_organization_id !== org.id, {
      error: messages.relatedOrg,
      path: ["related_organization_id"],
    })

  return { create, update }
}

const SCHEMAS = {
  investor: buildSchemas("investor"),
  customer: buildSchemas("customer"),
} satisfies Record<OrgKind, ReturnType<typeof buildSchemas>>

/** New investor or customer: name, owner, next step and date are required. */
export function orgInputSchemaFor(kind: OrgKind) {
  return SCHEMAS[kind].create
}

/** Edit: every field plus the org's id (its kind can't change). */
export function orgUpdateSchemaFor(kind: OrgKind) {
  return SCHEMAS[kind].update
}

export const orgKindValueSchema = z.enum(ORG_KINDS, {
  error: "Choose investor or customer.",
})

/** A create that names its kind in the body (the Stage 6 bot API). */
export const orgCreateSchema = z.discriminatedUnion("kind", [
  SCHEMAS.investor.create.extend({ kind: z.literal("investor") }),
  SCHEMAS.customer.create.extend({ kind: z.literal("customer") }),
])

export const orgIdSchema = recordIdSchema("That record doesn't exist.")

/** What a form or the bot may send (stage may be left out). */
export type OrgInputValues = z.input<ReturnType<typeof orgInputSchemaFor>>
/** What the create schema returns: ready to insert with `kind`. */
export type OrgInput = z.output<ReturnType<typeof orgInputSchemaFor>>
export type OrgUpdate = z.output<ReturnType<typeof orgUpdateSchemaFor>>

/** The org form's field names, in form order (also the keys refilled after an error). */
export const ORG_FORM_FIELDS = [
  "name",
  "subtype",
  "stage",
  "owner_id",
  "next_step",
  "next_step_date",
  "contact_name",
  "contact_title",
  "contact_email",
  "contact_phone",
  "link",
  "city",
  "state_or_country",
  "region",
  "first_contact_date",
  "first_contact_method",
  "introduced_by",
  "check_size_or_focus",
  "last_contact_date",
  "notes",
  "key_result_id",
  "related_organization_id",
] as const satisfies readonly (keyof OrgUpdate)[]
export type OrgFormField = (typeof ORG_FORM_FIELDS)[number]
