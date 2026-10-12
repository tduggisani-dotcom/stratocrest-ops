import { z } from "zod"
import { isIsoDate } from "@/lib/dates"
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/labels"

/**
 * Tasks (spec §6.4). One source for the task form, its Server Actions and (in
 * Stage 6) the bot API, so field names are the database column names.
 *
 * Implementation intentions (principle 5): every task has ONE owner, a concrete
 * next action, and a due date. The database enforces the same rules (NOT NULL +
 * CHECK); these messages are what a person sees first.
 */

/** Mirrors the CHECK constraints on public.tasks. */
export const TASK_LIMITS = {
  title: 200,
  next_action: 500,
  notes: 20_000,
} as const

export const TASK_MESSAGES = {
  title: "Give the task a short title.",
  titleTooLong: `Keep the title to ${TASK_LIMITS.title} characters or fewer.`,
  nextAction: 'What\'s the very next step? For example: "Email Jane the deck".',
  nextActionTooLong: `Keep the next action to ${TASK_LIMITS.next_action} characters or fewer.`,
  owner: "Choose who owns this task.",
  dueDate: "Pick a due date.",
  dueDateRange: "That date looks off. Check the year.",
  status: "Choose a status.",
  priority: "Choose a priority.",
  notesTooLong: `Notes are limited to ${TASK_LIMITS.notes.toLocaleString("en-US")} characters.`,
  link: "That link isn't valid any more. Choose it again.",
  task: "That task doesn't exist.",
} as const

/** Optional links from a task to what it moves forward. Order = the form's order. */
export const TASK_LINK_FIELDS = [
  "organization_id",
  "synthe6_session_id",
  "key_result_id",
  "team_meeting_id",
  "org_meeting_id",
] as const
export type TaskLinkField = (typeof TASK_LINK_FIELDS)[number]

// A due date far outside the program is almost always a typo ("0026-10-14").
const EARLIEST_DUE_DATE = "2020-01-01"
const LATEST_DUE_DATE = "2100-12-31"

export const taskIdSchema = z.uuid({ error: TASK_MESSAGES.task })

export const taskStatusValueSchema = z.enum(TASK_STATUSES, { error: TASK_MESSAGES.status })
export const taskPriorityValueSchema = z.enum(TASK_PRIORITIES, { error: TASK_MESSAGES.priority })

const titleSchema = z
  .string({ error: TASK_MESSAGES.title })
  .trim()
  .min(1, TASK_MESSAGES.title)
  .max(TASK_LIMITS.title, TASK_MESSAGES.titleTooLong)

const nextActionSchema = z
  .string({ error: TASK_MESSAGES.nextAction })
  .trim()
  .min(1, TASK_MESSAGES.nextAction)
  .max(TASK_LIMITS.next_action, TASK_MESSAGES.nextActionTooLong)

/** "YYYY-MM-DD", a calendar day in America/New_York. */
const dueDateSchema = z
  .string({ error: TASK_MESSAGES.dueDate })
  .trim()
  .refine(isIsoDate, { error: TASK_MESSAGES.dueDate, abort: true })
  .refine((d) => d >= EARLIEST_DUE_DATE && d <= LATEST_DUE_DATE, TASK_MESSAGES.dueDateRange)

/** undefined = leave as is (or none, on create); null = clear the link. */
const linkSchema = z.uuid({ error: TASK_MESSAGES.link }).nullish()

/** undefined = leave as is; null = clear. */
const notesSchema = z.string().trim().max(TASK_LIMITS.notes, TASK_MESSAGES.notesTooLong).nullish()

/**
 * Create, or replace every editable field (the task form sends them all).
 * Status defaults to To Do and priority to Medium.
 */
export const taskInputSchema = z.object({
  title: titleSchema,
  next_action: nextActionSchema,
  owner_id: z.uuid({ error: TASK_MESSAGES.owner }),
  due_date: dueDateSchema,
  status: taskStatusValueSchema.default("to_do"),
  priority: taskPriorityValueSchema.default("medium"),
  notes: notesSchema,
  organization_id: linkSchema,
  synthe6_session_id: linkSchema,
  key_result_id: linkSchema,
  team_meeting_id: linkSchema,
  org_meeting_id: linkSchema,
})

/** The edit form: every field plus the task's id. */
export const taskUpdateSchema = taskInputSchema.extend({ id: taskIdSchema })

/** The inline status control on lists and the task page. */
export const taskStatusUpdateSchema = z.object({
  id: taskIdSchema,
  status: taskStatusValueSchema,
})

/** What the schema accepts (status and priority may be left out). */
export type TaskInputValues = z.input<typeof taskInputSchema>
/** What it returns: ready to insert into public.tasks. */
export type TaskInput = z.output<typeof taskInputSchema>
export type TaskUpdate = z.output<typeof taskUpdateSchema>
export type TaskStatusUpdate = z.output<typeof taskStatusUpdateSchema>
export type TaskStatus = z.output<typeof taskStatusValueSchema>
export type TaskPriority = z.output<typeof taskPriorityValueSchema>
