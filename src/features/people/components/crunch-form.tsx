"use client"

import { useActionState, useRef } from "react"
import { PlusIcon } from "lucide-react"
import { FormMessage } from "@/components/forms/form-message"
import { SubmitButton } from "@/components/forms/submit-button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { addCrunchPeriod } from "@/features/people/actions"
import { withConnectionErrors } from "@/lib/action-calls"
import { initialFormState } from "@/lib/forms"
import { PEOPLE_LIMITS } from "@/lib/schemas/people"
import { fieldValue, formKey, invalidProps, useFormFeedback } from "./use-form-feedback"

// A request that fails (no signal, server error) keeps what was typed.
const addPeriod = withConnectionErrors(addCrunchPeriod)

/** Add a crunch period (finals, a deadline at work…) for `personId`. Dates are ET days. */
export function CrunchForm({ personId, headingId }: { personId: string; headingId: string }) {
  const [state, formAction] = useActionState(addPeriod, initialFormState)
  const formRef = useRef<HTMLFormElement>(null)
  useFormFeedback(state, formRef)
  const errors = state.fieldErrors ?? {}

  return (
    <form
      key={formKey(state)}
      ref={formRef}
      action={formAction}
      noValidate
      aria-labelledby={headingId}
      className="space-y-4"
    >
      <input type="hidden" name="person_id" value={personId} />
      <Field data-invalid={errors.label ? true : undefined}>
        <FieldLabel htmlFor="crunch-label">What it is</FieldLabel>
        <Input
          id="crunch-label"
          name="label"
          required
          maxLength={PEOPLE_LIMITS.crunchLabel}
          placeholder="e.g. Finals"
          defaultValue={fieldValue(state, "label")}
          {...invalidProps(errors.label, "crunch-label-error")}
        />
        <FieldError id="crunch-label-error">{errors.label}</FieldError>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.start_date ? true : undefined}>
          <FieldLabel htmlFor="crunch-start">First day</FieldLabel>
          <Input
            id="crunch-start"
            name="start_date"
            type="date"
            required
            defaultValue={fieldValue(state, "start_date")}
            {...invalidProps(errors.start_date, "crunch-start-error")}
          />
          <FieldError id="crunch-start-error">{errors.start_date}</FieldError>
        </Field>
        <Field data-invalid={errors.end_date ? true : undefined}>
          <FieldLabel htmlFor="crunch-end">Last day</FieldLabel>
          <Input
            id="crunch-end"
            name="end_date"
            type="date"
            required
            defaultValue={fieldValue(state, "end_date")}
            {...invalidProps(errors.end_date, "crunch-end-error")}
          />
          <FieldError id="crunch-end-error">{errors.end_date}</FieldError>
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Adding…" className="max-sm:w-full">
        <PlusIcon aria-hidden />
        Add crunch period
      </SubmitButton>
    </form>
  )
}
