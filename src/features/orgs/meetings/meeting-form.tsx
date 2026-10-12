"use client"

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PersonAvatar } from "@/components/common/person-chip"
import { FormMessage } from "@/components/forms/form-message"
import { PersonSelect } from "@/components/forms/person-select"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formKey } from "@/features/people/components/use-form-feedback"
import { withConnectionErrors } from "@/lib/action-calls"
import { ORG_LIMITS } from "@/lib/schemas/organizations"
import { ORG_MEETING_LIMITS, type OrgMeetingFormField } from "@/lib/schemas/org-meetings"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import { logOrgMeeting, updateOrgMeeting } from "./actions"
import { NEXT_STEP_DATE_ORIGINAL, NEXT_STEP_ORIGINAL } from "./form-data"
import { isFutureMeeting } from "./helpers"
import type { MeetingPerson } from "./queries"
import { initialMeetingFormState, type MeetingFormState } from "./types"

/** The form's starting values, as the strings the inputs hold (attendee_ids comma-joined). */
export type MeetingFormDefaults = Partial<Record<OrgMeetingFormField, string>>

type MeetingFormProps = {
  kind: OrgKind
  orgId: string
  /** Our side to pick from (active teammates, plus anyone already on the meeting). */
  people: readonly MeetingPerson[]
  defaults: MeetingFormDefaults
  /** The org's next step as it is now: prefilled, and sent only if changed. */
  orgNextStep: { step: string; date: string }
  /** When the page was rendered (ms), for the "rate it after it happens" hint. */
  nowMs: number
} & (
  | { mode: "create"; cancelHref: Route; meetingId?: never }
  | { mode: "edit"; meetingId: string; cancelHref?: never }
)

/** A failed request (lost signal, server error) keeps what was typed. */
const meetingFormActions = {
  create: withConnectionErrors(logOrgMeeting),
  edit: withConnectionErrors(updateOrgMeeting),
} satisfies Record<MeetingFormProps["mode"], unknown>

const RATINGS = ["1", "2", "3", "4", "5"] as const

/**
 * Log a meeting with an investor or customer (screen 1 of 2), or edit one.
 * One form: when, who went from our side and theirs, how it went (1–5 and a
 * one-line summary), notes, concerns, what they asked for, who follows up by
 * when, and the org's next step (prefilled; change it if the meeting did).
 *
 * A plain <form> with a Server Action: inputs are uncontrolled and refilled
 * after an error, and focus moves to the first field with a problem. After
 * logging, it goes to the meeting's page (screen 2: debrief + follow-up task).
 */
export function MeetingForm(props: MeetingFormProps) {
  // Next keeps visited pages alive (React <Activity>): start a fresh form after each log.
  const [generation, setGeneration] = useState(0)
  return (
    <MeetingFormBody key={generation} {...props} onLogged={() => setGeneration((n) => n + 1)} />
  )
}

function MeetingFormBody(props: MeetingFormProps & { onLogged: () => void }) {
  const { kind, mode, people, defaults, orgNextStep, onLogged } = props
  const [state, formAction] = useActionState<MeetingFormState, FormData>(
    meetingFormActions[mode],
    initialMeetingFormState,
  )
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  const ids = (name: string) => ({
    input: `${uid}-${name}`,
    hint: `${uid}-${name}-hint`,
    error: `${uid}-${name}-error`,
  })
  const value = (name: OrgMeetingFormField) =>
    state.status === "error" ? (state.values?.[name] ?? "") : (defaults[name] ?? "")
  const error = (name: OrgMeetingFormField) => state.fieldErrors?.[name]

  // "Rate it after it happens": follows the date and time shown, and edits to them
  // since the last submit (or since the saved values changed under us).
  const shown = { date: value("meeting_date"), time: value("meeting_time") }
  const basis = `${shown.date}|${shown.time}`
  const [edited, setEdited] = useState<{
    state: MeetingFormState
    basis: string
    future?: boolean
  }>({ state, basis })
  const current = edited.state === state && edited.basis === basis ? edited : null
  const future = current?.future ?? isFutureMeeting(shown.date, shown.time, new Date(props.nowMs))

  // React to each result once, even if Activity hides and shows the page again.
  const handled = useRef<MeetingFormState>(state)
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state
    const form = formRef.current

    if (state.status === "error") {
      // The first field with a problem (in a radio group, the picked one); the
      // submit button for a whole-form error.
      const invalid = form?.querySelector<HTMLElement>(
        '[aria-invalid="true"], input[type="radio"][data-invalid="true"]',
      )
      const picked =
        invalid instanceof HTMLInputElement && invalid.type === "radio"
          ? form?.querySelector<HTMLElement>(`input[name="${invalid.name}"]:checked`)
          : null
      const target = picked ?? invalid ?? form?.querySelector<HTMLElement>('[type="submit"]')
      target?.focus()
      return
    }
    if (state.status !== "success") return
    if (mode === "create") {
      router.push(state.redirectTo ?? props.cancelHref ?? "/")
      onLogged()
    } else {
      toast.success(state.message ?? "Meeting saved")
      form?.querySelector<HTMLElement>('[type="submit"]')?.focus()
    }
  }, [state, mode, router, onLogged, props.cancelHref])

  const selected = new Set(value("attendee_ids").split(",").filter(Boolean))
  const noun = kindConfig(kind).singular

  return (
    <form
      // Remount after an error (refill what was typed) or when the saved meeting changes.
      key={formKey(state, defaults)}
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-6"
      onChange={(event) => {
        const target = event.target
        if (!(target instanceof HTMLInputElement)) return
        if (target.name !== "meeting_date" && target.name !== "meeting_time") return
        const form = target.form
        const date = form?.elements.namedItem("meeting_date")
        const time = form?.elements.namedItem("meeting_time")
        if (date instanceof HTMLInputElement && time instanceof HTMLInputElement) {
          const next = isFutureMeeting(date.value, time.value, new Date())
          setEdited({ state, basis, future: next })
        }
      }}
    >
      {mode === "create" ? (
        <input type="hidden" name="organization_id" value={props.orgId} />
      ) : (
        <input type="hidden" name="id" value={props.meetingId} />
      )}
      <input type="hidden" name={NEXT_STEP_ORIGINAL} value={orgNextStep.step} />
      <input type="hidden" name={NEXT_STEP_DATE_ORIGINAL} value={orgNextStep.date} />

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">When</legend>
        <div className="grid grid-cols-2 gap-3 md:max-w-md">
          <TextField
            name="meeting_date"
            label="Date"
            type="date"
            required
            ids={ids("meeting_date")}
            error={error("meeting_date")}
            defaultValue={value("meeting_date")}
          />
          <TextField
            name="meeting_time"
            label="Time (ET)"
            type="time"
            required
            ids={ids("meeting_time")}
            error={error("meeting_time")}
            defaultValue={value("meeting_time")}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          A future date logs a scheduled meeting: rate it and write the debrief after it happens.
        </p>
      </fieldset>

      <fieldset
        className="space-y-3"
        aria-describedby={error("attendee_ids") ? ids("attendee_ids").error : undefined}
      >
        <legend className="mb-3 text-sm font-medium">
          Who went from our side <RequiredMark />
        </legend>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {people.map((person) => (
            <label
              key={person.id}
              className={cn(
                "flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm md:min-h-9",
                "has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium",
                "has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                error("attendee_ids") && "border-destructive",
              )}
            >
              <input
                type="checkbox"
                name="attendee_ids"
                value={person.id}
                defaultChecked={selected.has(person.id)}
                aria-invalid={error("attendee_ids") ? true : undefined}
                className="size-4 shrink-0 accent-primary outline-none"
              />
              <PersonAvatar person={person} size="sm" />
              <span className="truncate">{person.name}</span>
            </label>
          ))}
        </div>
        <FieldError id={ids("attendee_ids").error}>{error("attendee_ids")}</FieldError>
      </fieldset>

      <TextField
        name="external_attendees"
        label="Who was there from their side"
        description="Names and roles, e.g. Jane Doe (partner), Sam Lee (associate)."
        ids={ids("external_attendees")}
        error={error("external_attendees")}
        maxLength={ORG_MEETING_LIMITS.external_attendees}
        defaultValue={value("external_attendees")}
        autoComplete="off"
      />

      <fieldset
        className="space-y-3"
        aria-describedby={
          [ids("rating").hint, error("rating") ? ids("rating").error : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        <legend className="mb-3 text-sm font-medium">How did it go?</legend>
        <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
          {["", ...RATINGS].map((rating) => (
            <label
              key={rating || "none"}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm tabular-nums md:min-h-9",
                "has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium",
                "has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                error("rating") && "border-destructive",
              )}
            >
              <input
                type="radio"
                name="rating"
                value={rating}
                defaultChecked={value("rating") === rating}
                // Radios can't carry aria-invalid; the fieldset is described by the error.
                data-invalid={error("rating") ? true : undefined}
                className="size-4 accent-primary outline-none"
              />
              {rating === "" ? (
                "Not rated"
              ) : (
                <span>
                  {rating}
                  <span className="sr-only"> out of 5</span>
                </span>
              )}
            </label>
          ))}
        </div>
        <p id={ids("rating").hint} aria-live="polite" className="text-sm text-muted-foreground">
          {future
            ? "This meeting hasn't happened yet: rate it after it does."
            : "1 = poor, 5 = great. A rating needs a one-line summary."}
        </p>
        <FieldError id={ids("rating").error}>{error("rating")}</FieldError>
      </fieldset>

      <TextField
        name="summary"
        label="One-line summary"
        description={`How it went, in one line. Shown in the ${kindConfig(kind).plural.toLowerCase()} table next to the rating.`}
        ids={ids("summary")}
        error={error("summary")}
        maxLength={ORG_MEETING_LIMITS.summary}
        defaultValue={value("summary")}
        autoComplete="off"
      />

      <TextField
        name="notes"
        label="Notes"
        description="Optional. What was discussed, what we learned."
        multiline
        rows={4}
        ids={ids("notes")}
        error={error("notes")}
        maxLength={ORG_MEETING_LIMITS.notes}
        defaultValue={value("notes")}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="concerns_raised"
          label="Concerns they raised"
          description="Optional."
          multiline
          rows={2}
          ids={ids("concerns_raised")}
          error={error("concerns_raised")}
          maxLength={ORG_MEETING_LIMITS.concerns_raised}
          defaultValue={value("concerns_raised")}
        />
        <TextField
          name="materials_requested"
          label="Materials they asked for"
          description="Optional. E.g. the deck, test data."
          multiline
          rows={2}
          ids={ids("materials_requested")}
          error={error("materials_requested")}
          maxLength={ORG_MEETING_LIMITS.materials_requested}
          defaultValue={value("materials_requested")}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Follow-up</legend>
        <div className="grid gap-6 md:grid-cols-2">
          <Field data-invalid={error("follow_up_owner_id") ? true : undefined}>
            <FieldLabel htmlFor={ids("follow_up_owner_id").input}>Who follows up</FieldLabel>
            <PersonSelect
              // A select only picks up a new default when it remounts.
              key={`follow-up:${value("follow_up_owner_id")}`}
              id={ids("follow_up_owner_id").input}
              name="follow_up_owner_id"
              people={people}
              emptyLabel="No follow-up"
              defaultValue={value("follow_up_owner_id")}
              {...invalidProps(ids("follow_up_owner_id"), error("follow_up_owner_id"))}
            />
            <FieldError id={ids("follow_up_owner_id").error}>
              {error("follow_up_owner_id")}
            </FieldError>
          </Field>
          <TextField
            name="follow_up_date"
            label="By when"
            type="date"
            ids={ids("follow_up_date")}
            error={error("follow_up_date")}
            defaultValue={value("follow_up_date")}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Pick both, or leave both empty for no follow-up.
        </p>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">
          The {noun.toLowerCase()}&apos;s next step
        </legend>
        <p className="text-sm text-muted-foreground">
          Update the next step if this meeting changed it.
        </p>
        <TextField
          name="next_step"
          label="Next step"
          multiline
          rows={2}
          ids={ids("next_step")}
          error={error("next_step")}
          maxLength={ORG_LIMITS.next_step}
          defaultValue={value("next_step")}
        />
        <div className="md:max-w-xs">
          <TextField
            name="next_step_date"
            label="Next step date"
            type="date"
            ids={ids("next_step_date")}
            error={error("next_step_date")}
            defaultValue={value("next_step_date")}
          />
        </div>
      </fieldset>

      <FormMessage state={state} />

      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
        <SubmitButton
          pendingLabel={mode === "create" ? "Logging…" : "Saving…"}
          className="max-md:w-full"
        >
          {mode === "create" ? "Log meeting" : "Save changes"}
        </SubmitButton>
        {mode === "create" ? (
          <Button asChild variant="ghost" className="max-md:w-full">
            <Link href={props.cancelHref}>Cancel</Link>
          </Button>
        ) : null}
      </div>
    </form>
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

type FieldIds = { input: string; hint: string; error: string }

/** aria-invalid + aria-describedby (hint, then error) for one control. */
function invalidProps(ids: FieldIds, error: string | undefined, hasHint = false) {
  const describedBy = [hasHint ? ids.hint : null, error ? ids.error : null]
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
  defaultValue,
  maxLength,
  rows,
  type = "text",
  autoComplete,
}: {
  name: string
  label: ReactNode
  description?: string
  required?: boolean
  multiline?: boolean
  ids: FieldIds
  error: string | undefined
  defaultValue: string
  maxLength?: number
  rows?: number
  type?: string
  autoComplete?: string
}) {
  const shared = {
    id: ids.input,
    name,
    defaultValue,
    maxLength,
    "aria-required": required ? ("true" as const) : undefined,
    ...invalidProps(ids, error, Boolean(description)),
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
          rows={rows}
          // The textarea sizes to its content, so set a starting height (≥ 44 px to tap).
          className={(rows ?? 0) > 2 ? "min-h-24" : "min-h-16"}
        />
      ) : (
        <Input {...shared} type={type} autoComplete={autoComplete} />
      )}
      {description ? <FieldDescription id={ids.hint}>{description}</FieldDescription> : null}
      <FieldError id={ids.error}>{error}</FieldError>
    </Field>
  )
}
