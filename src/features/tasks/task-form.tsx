"use client"

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { FormMessage } from "@/components/forms/form-message"
import { PersonSelect } from "@/components/forms/person-select"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { crunchPeriodsCovering, crunchWarning } from "@/lib/crunch"
import { formatDate, isIsoDate } from "@/lib/dates"
import {
  ORG_KINDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  orgKindLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels"
import { TASK_LIMITS, type TaskLinkField } from "@/lib/schemas/tasks"
import { cn } from "@/lib/utils"
import { createTask, updateTask } from "./actions"
import { taskHref } from "./links"
import type { LinkOption, TaskFormOptions } from "./options"
import { initialTaskFormState, type TaskFormState } from "./types"

/** The form's starting values, as the strings the inputs hold. */
export type TaskFormDefaults = Partial<
  Record<
    "title" | "next_action" | "owner_id" | "due_date" | "status" | "priority" | "notes",
    string
  > &
    Record<TaskLinkField, string>
>

type TaskFormProps = {
  options: TaskFormOptions
  defaults: TaskFormDefaults
} & (
  | { mode: "create"; returnTo: Route; taskId?: never }
  | { mode: "edit"; taskId: string; returnTo?: never }
)

/**
 * Add or edit a task (spec §6.4). One owner, a concrete next action and a due
 * date are required; links to an org, session, key result or meeting are
 * optional and tucked into "Link to…".
 *
 * A plain <form> with a Server Action: inputs are uncontrolled and refilled
 * from what was submitted after an error, and focus moves to the first field
 * with a problem. While you pick an owner and a date, the form warns (never
 * blocks) when the date falls in that person's crunch period.
 */
export function TaskForm(props: TaskFormProps) {
  // Next keeps visited pages alive (React <Activity>), so a new-task form would
  // otherwise come back showing the last save. Start it fresh after each one.
  const [generation, setGeneration] = useState(0)
  return <TaskFormBody key={generation} {...props} onCreated={() => setGeneration((n) => n + 1)} />
}

function TaskFormBody(props: TaskFormProps & { onCreated: () => void }) {
  const { mode, options, defaults, onCreated } = props
  const [state, formAction] = useActionState<TaskFormState, FormData>(
    mode === "create" ? createTask : updateTask,
    initialTaskFormState,
  )
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  const ids = (name: string) => ({
    input: `${uid}-${name}`,
    description: `${uid}-${name}-description`,
    error: `${uid}-${name}-error`,
  })

  /** What the field shows: what was just submitted (after an error), else the default. */
  const value = (name: keyof TaskFormDefaults | "status" | "priority") =>
    state.values?.[name] ?? defaults[name] ?? ""
  const error = (name: string) => state.fieldErrors?.[name]

  // Owner, date and status drive the crunch warning. Track edits since the last
  // submit (or since the saved values changed under us) on top of the shown values.
  const shown = { owner: value("owner_id"), due: value("due_date"), status: value("status") }
  const basis = `${shown.owner}|${shown.due}|${shown.status}`
  const [edits, setEdits] = useState<
    { state: TaskFormState; basis: string } & Partial<typeof shown>
  >({ state, basis })
  const current = edits.state === state && edits.basis === basis ? edits : null
  const watched = {
    owner: current?.owner ?? shown.owner,
    due: current?.due ?? shown.due,
    status: current?.status ?? shown.status,
  }
  function watch(field: keyof typeof shown, next: string) {
    setEdits((prev) => ({
      ...(prev.state === state && prev.basis === basis ? prev : { state, basis }),
      [field]: next,
    }))
  }

  const crunchWarnings = liveCrunchWarnings(options, watched)

  // React to each action result once, even if Activity hides and shows the page again.
  const handled = useRef<TaskFormState>(state)
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state

    if (state.status === "error") {
      // Open "Link to…" if needed and focus the first field with a problem.
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      const details = invalid?.closest("details")
      if (details) details.open = true
      invalid?.focus()
      return
    }

    // Saved: confirm, mention any crunch warning, and (for a new task) move on.
    const description = state.warnings?.join(" ") || undefined
    if (mode === "create") {
      const id = state.id
      toast.success("Task added", {
        description,
        action: id ? { label: "Open", onClick: () => router.push(taskHref(id)) } : undefined,
      })
      router.push(state.redirectTo ?? "/tasks")
      onCreated()
    } else {
      toast.success("Changes saved", { description })
    }
  }, [state, mode, router, onCreated])

  const links = linkFields(options)
  const hasLink = links.some((link) => value(link.name) !== "")

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-6"
      onChange={(event) => {
        const target = event.nativeEvent.target
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return
        if (target.name === "owner_id") watch("owner", target.value)
        else if (target.name === "due_date") watch("due", target.value)
        else if (target.name === "status") watch("status", target.value)
      }}
    >
      {mode === "edit" ? <input type="hidden" name="id" value={props.taskId} /> : null}
      {mode === "create" ? <input type="hidden" name="return_to" value={props.returnTo} /> : null}

      <TextField
        name="title"
        label="Title"
        required
        ids={ids("title")}
        error={error("title")}
        maxLength={TASK_LIMITS.title}
        defaultValue={value("title")}
        autoComplete="off"
      />

      <TextField
        name="next_action"
        label="Next action"
        description='The very next physical step, e.g. "Email Jane the deck".'
        required
        multiline
        rows={2}
        ids={ids("next_action")}
        error={error("next_action")}
        maxLength={TASK_LIMITS.next_action}
        defaultValue={value("next_action")}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Field data-invalid={error("owner_id") ? true : undefined}>
          <FieldLabel htmlFor={ids("owner_id").input}>
            Owner <RequiredMark />
          </FieldLabel>
          <PersonSelect
            // A select only picks up a new default when it remounts.
            key={`owner:${value("owner_id")}`}
            id={ids("owner_id").input}
            name="owner_id"
            people={options.people}
            defaultValue={value("owner_id")}
            aria-required="true"
            {...invalidProps(ids("owner_id"), error("owner_id"))}
          />
          <FieldError id={ids("owner_id").error}>{error("owner_id")}</FieldError>
        </Field>

        <TextField
          name="due_date"
          label="Due date"
          type="date"
          required
          ids={ids("due_date")}
          error={error("due_date")}
          defaultValue={value("due_date")}
          extraDescribedBy={crunchWarnings.length > 0 ? `${uid}-crunch` : undefined}
        />
      </div>

      {/* Always rendered, so screen readers hear the warning when it appears. */}
      <div id={`${uid}-crunch`} aria-live="polite" className="empty:hidden">
        {crunchWarnings.map((warning) => (
          <p
            key={warning}
            className="flex items-start gap-2 rounded-md border border-stale/40 bg-stale-soft px-3 py-2 text-sm text-stale"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{warning} You can still save it.</span>
          </p>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Priority</legend>
          <div className="grid grid-cols-3 gap-2">
            {TASK_PRIORITIES.map((priority) => (
              <label
                key={priority}
                className={cn(
                  "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-2 text-sm md:h-9",
                  "has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium",
                  "has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                )}
              >
                <input
                  type="radio"
                  name="priority"
                  value={priority}
                  defaultChecked={(value("priority") || "medium") === priority}
                  className="size-4 accent-primary outline-none"
                />
                {taskPriorityLabels[priority]}
              </label>
            ))}
          </div>
          {error("priority") ? (
            <FieldError id={ids("priority").error}>{error("priority")}</FieldError>
          ) : null}
        </fieldset>

        {mode === "edit" ? (
          <Field data-invalid={error("status") ? true : undefined}>
            <FieldLabel htmlFor={ids("status").input}>Status</FieldLabel>
            <NativeSelect
              key={`status:${value("status")}`}
              id={ids("status").input}
              name="status"
              defaultValue={value("status") || "to_do"}
              {...invalidProps(ids("status"), error("status"))}
            >
              {TASK_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {taskStatusLabels[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError id={ids("status").error}>{error("status")}</FieldError>
          </Field>
        ) : null}
      </div>

      <TextField
        name="notes"
        label="Notes"
        description="Optional. Context, links, anything the owner should know."
        multiline
        rows={4}
        ids={ids("notes")}
        error={error("notes")}
        maxLength={TASK_LIMITS.notes}
        defaultValue={value("notes")}
      />

      <details open={hasLink} className="group rounded-xl border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          {/* Its own box, so a long hint wraps under itself instead of squeezing "Link to…". */}
          <span className="shrink-0">Link to…</span>
          <span className="font-normal text-muted-foreground">
            an org, session, key result or meeting (optional)
          </span>
        </summary>
        <div className="grid gap-6 border-t p-4 md:grid-cols-2">
          {links.map((link) => (
            <Field key={link.name} data-invalid={error(link.name) ? true : undefined}>
              <FieldLabel htmlFor={ids(link.name).input}>{link.label}</FieldLabel>
              <NativeSelect
                key={`${link.name}:${value(link.name)}`}
                id={ids(link.name).input}
                name={link.name}
                defaultValue={value(link.name)}
                {...invalidProps(ids(link.name), error(link.name), link.empty)}
              >
                <NativeSelectOption value="">None</NativeSelectOption>
                {link.groups.flatMap((group) =>
                  group.label
                    ? [
                        <NativeSelectOptGroup key={group.label} label={group.label}>
                          {group.options.map(renderOption)}
                        </NativeSelectOptGroup>,
                      ]
                    : group.options.map(renderOption),
                )}
              </NativeSelect>
              {link.empty ? (
                <FieldDescription id={ids(link.name).description}>{link.empty}</FieldDescription>
              ) : null}
              <FieldError id={ids(link.name).error}>{error(link.name)}</FieldError>
            </Field>
          ))}
        </div>
      </details>

      <FormMessage state={{ ...state, warnings: undefined }} />

      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
        <SubmitButton
          pendingLabel={mode === "create" ? "Adding…" : "Saving…"}
          className="max-md:w-full"
        >
          {mode === "create" ? "Add task" : "Save changes"}
        </SubmitButton>
        {mode === "create" ? (
          <Button asChild variant="ghost" className="max-md:w-full">
            <Link href={props.returnTo}>Cancel</Link>
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function renderOption(option: LinkOption) {
  return (
    <NativeSelectOption key={option.value} value={option.value}>
      {option.label}
    </NativeSelectOption>
  )
}

function RequiredMark() {
  return (
    <span className="font-normal text-muted-foreground">
      <span aria-hidden>*</span>
      <span className="sr-only">(required)</span>
    </span>
  )
}

type FieldIds = { input: string; description: string; error: string }

/** aria-invalid + aria-describedby (description, then error) for one control. */
function invalidProps(ids: FieldIds, error: string | undefined, description?: unknown) {
  const describedBy = [description ? ids.description : null, error ? ids.error : null]
    .filter(Boolean)
    .join(" ")
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const
}

function TextField({
  name,
  label,
  description,
  required = false,
  multiline = false,
  ids,
  error,
  extraDescribedBy,
  ...inputProps
}: {
  name: string
  label: ReactNode
  description?: string
  required?: boolean
  multiline?: boolean
  ids: FieldIds
  error: string | undefined
  extraDescribedBy?: string
  defaultValue: string
  maxLength?: number
  rows?: number
  type?: string
  autoComplete?: string
}) {
  const aria = invalidProps(ids, error, description)
  const describedBy =
    [aria["aria-describedby"], extraDescribedBy].filter(Boolean).join(" ") || undefined
  const shared = {
    id: ids.input,
    name,
    "aria-required": required ? ("true" as const) : undefined,
    "aria-invalid": aria["aria-invalid"],
    "aria-describedby": describedBy,
  }
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={ids.input}>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      {multiline ? (
        <Textarea
          {...shared}
          rows={inputProps.rows}
          maxLength={inputProps.maxLength}
          defaultValue={inputProps.defaultValue}
          // The textarea sizes to its content (rows is ignored), so set a starting
          // height: at least 44 px to tap, taller where longer text is expected.
          className={(inputProps.rows ?? 0) > 2 ? "min-h-24" : undefined}
        />
      ) : (
        <Input
          {...shared}
          type={inputProps.type ?? "text"}
          maxLength={inputProps.maxLength}
          autoComplete={inputProps.autoComplete}
          defaultValue={inputProps.defaultValue}
        />
      )}
      {description ? <FieldDescription id={ids.description}>{description}</FieldDescription> : null}
      <FieldError id={ids.error}>{error}</FieldError>
    </Field>
  )
}

type LinkGroup = { label?: string; options: LinkOption[] }

/** The "Link to…" selects, in form order, with an empty-list note when there's nothing to pick. */
function linkFields(options: TaskFormOptions): {
  name: TaskLinkField
  label: string
  groups: LinkGroup[]
  empty?: string
}[] {
  const orgGroups = ORG_KINDS.map((kind) => ({
    label: orgKindLabels[kind].plural,
    options: options.organizations.filter((o) => o.kind === kind),
  })).filter((group) => group.options.length > 0)
  const single = (list: LinkOption[]): LinkGroup[] => (list.length ? [{ options: list }] : [])
  return [
    {
      name: "organization_id",
      label: "Investor or customer",
      groups: orgGroups,
      empty: options.organizations.length ? undefined : "No investors or customers yet.",
    },
    {
      name: "synthe6_session_id",
      label: "Synthe6 session",
      groups: single(options.sessions),
      empty: options.sessions.length ? undefined : "No upcoming sessions.",
    },
    {
      name: "key_result_id",
      label: "Key result",
      groups: single(options.keyResults),
      empty: options.keyResults.length ? undefined : "No key results yet.",
    },
    {
      name: "team_meeting_id",
      label: "Sunday meeting",
      groups: single(options.teamMeetings),
      empty: options.teamMeetings.length ? undefined : "No recent or upcoming Sunday meetings.",
    },
    {
      name: "org_meeting_id",
      label: "Investor or customer meeting",
      groups: single(options.orgMeetings),
      empty: options.orgMeetings.length ? undefined : "No recent or upcoming meetings.",
    },
  ]
}

/** Crunch warnings for the owner and due date currently in the form (not for done tasks). */
function liveCrunchWarnings(
  options: TaskFormOptions,
  watched: { owner: string; due: string; status: string },
): string[] {
  if (watched.status === "done" || !isIsoDate(watched.due)) return []
  const owner = options.people.find((p) => p.id === watched.owner)
  if (!owner) return []
  return crunchPeriodsCovering(options.crunchPeriods, owner.id, watched.due).map((period) =>
    crunchWarning(owner.name, period, (day) => formatDate(day, "short")),
  )
}
