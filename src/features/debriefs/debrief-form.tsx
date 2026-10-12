"use client"

import { useActionState, useId, useRef, type ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { CircleCheck, Loader2, RotateCcw, Save } from "lucide-react"
import { FormMessage } from "@/components/forms/form-message"
import { PersonSelect } from "@/components/forms/person-select"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  fieldValue,
  formKey,
  invalidProps,
  useFormFeedback,
} from "@/features/people/components/use-form-feedback"
import { withConnectionErrors } from "@/lib/action-calls"
import { DEBRIEF_LIMITS } from "@/lib/schemas/debriefs"
import { updateDebrief } from "./actions"
import type { DebriefIntent } from "./form-data"
import { DEBRIEF_QUESTIONS } from "./template"
import { initialDebriefFormState, type DebriefDetail } from "./types"

// A request that fails (no signal, server error) keeps what was typed.
const saveDebrief = withConnectionErrors(updateDebrief)

type FormDebrief = Pick<
  DebriefDetail,
  "id" | "status" | "planned" | "actual" | "worked" | "change" | "facilitator"
>

/**
 * The debrief template (spec §6.7): what was planned, what happened, what
 * worked, what we'll change, and who facilitates. "Save" keeps a partly
 * written debrief due; "Save and mark done" closes it; a done one can be
 * reopened. Used on the meeting page (and Stage 4's debrief pages).
 */
export function DebriefForm({
  debrief,
  people,
}: {
  debrief: FormDebrief
  /** Who can facilitate (active teammates); the current facilitator is kept if inactive. */
  people: readonly { id: string; name: string }[]
}) {
  const [state, formAction] = useActionState(saveDebrief, initialDebriefFormState)
  const formRef = useRef<HTMLFormElement>(null)
  useFormFeedback(state, formRef)
  const uid = useId()
  const errors = state.fieldErrors ?? {}
  const done = debrief.status === "done"

  const saved = {
    planned: debrief.planned ?? "",
    actual: debrief.actual ?? "",
    worked: debrief.worked ?? "",
    change: debrief.change ?? "",
    facilitator_id: debrief.facilitator?.id ?? "",
  }
  const facilitators =
    debrief.facilitator && !people.some((p) => p.id === debrief.facilitator?.id)
      ? [...people, { id: debrief.facilitator.id, name: debrief.facilitator.name }]
      : people
  const facilitatorId = fieldValue(state, "facilitator_id", saved.facilitator_id)

  return (
    <form
      // Remount after an error (refill what was typed) or when the saved debrief changes.
      key={formKey(state, { ...saved, status: debrief.status })}
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-5"
    >
      <input type="hidden" name="id" value={debrief.id} />
      {DEBRIEF_QUESTIONS.map(({ field, label, hint }) => {
        const ids = {
          input: `${uid}-${field}`,
          hint: `${uid}-${field}-hint`,
          error: `${uid}-${field}-error`,
        }
        return (
          <Field key={field} data-invalid={errors[field] ? true : undefined}>
            <FieldLabel htmlFor={ids.input}>{label}</FieldLabel>
            <Textarea
              id={ids.input}
              name={field}
              rows={3}
              maxLength={DEBRIEF_LIMITS[field]}
              defaultValue={fieldValue(state, field, saved[field])}
              className="min-h-20"
              {...invalidProps(errors[field], ids.error, ids.hint)}
            />
            <FieldDescription id={ids.hint}>{hint}</FieldDescription>
            <FieldError id={ids.error}>{errors[field]}</FieldError>
          </Field>
        )
      })}

      <Field data-invalid={errors.facilitator_id ? true : undefined} className="md:max-w-sm">
        <FieldLabel htmlFor={`${uid}-facilitator`}>Facilitator</FieldLabel>
        <PersonSelect
          key={`facilitator:${facilitatorId}`}
          id={`${uid}-facilitator`}
          name="facilitator_id"
          people={facilitators}
          emptyLabel="No facilitator"
          defaultValue={facilitatorId}
          {...invalidProps(errors.facilitator_id, `${uid}-facilitator-error`)}
        />
        <FieldError id={`${uid}-facilitator-error`}>{errors.facilitator_id}</FieldError>
      </Field>

      <FormMessage state={state} />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {done ? (
          <>
            <IntentButton intent="save" pendingLabel="Saving…">
              <Save aria-hidden />
              Save
            </IntentButton>
            <IntentButton intent="reopen" variant="outline" pendingLabel="Reopening…">
              <RotateCcw aria-hidden />
              Reopen
            </IntentButton>
          </>
        ) : (
          <>
            <IntentButton intent="done" pendingLabel="Saving…">
              <CircleCheck aria-hidden />
              Save and mark done
            </IntentButton>
            <IntentButton intent="save" variant="outline" pendingLabel="Saving…">
              <Save aria-hidden />
              Save
            </IntentButton>
          </>
        )}
      </div>
    </form>
  )
}

/** A submit button that sends `intent`; while saving, every button is off and the pressed one says so. */
function IntentButton({
  intent,
  pendingLabel,
  variant = "default",
  children,
}: {
  intent: DebriefIntent
  pendingLabel: string
  variant?: "default" | "outline"
  children: ReactNode
}) {
  const { pending, data } = useFormStatus()
  const mine = pending && data?.get("intent") === intent
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      disabled={pending}
      aria-disabled={pending}
      className="max-md:w-full"
    >
      {mine ? (
        <>
          <Loader2 aria-hidden className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
