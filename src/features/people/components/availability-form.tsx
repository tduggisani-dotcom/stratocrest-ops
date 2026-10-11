"use client"

import { useActionState, useRef } from "react"
import { PlusIcon } from "lucide-react"
import { FormMessage } from "@/components/forms/form-message"
import { SubmitButton } from "@/components/forms/submit-button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { addAvailabilityBlock } from "@/features/people/actions"
import { WEEKDAYS } from "@/features/people/format"
import { initialFormState } from "@/lib/forms"
import { AVAILABILITY_LABELS, availabilityLabelLabels } from "@/lib/labels"
import { PEOPLE_LIMITS } from "@/lib/schemas/people"
import { fieldValue, formKey, invalidProps, useFormFeedback } from "./use-form-feedback"

/** Add one weekly busy time (class, work, other) for `personId`. Times are ET. */
export function AvailabilityForm({ personId, headingId }: { personId: string; headingId: string }) {
  const [state, formAction] = useActionState(addAvailabilityBlock, initialFormState)
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={errors.weekday ? true : undefined}>
          <FieldLabel htmlFor="availability-weekday">Day</FieldLabel>
          <NativeSelect
            id="availability-weekday"
            name="weekday"
            defaultValue={fieldValue(state, "weekday", "1")}
            {...invalidProps(errors.weekday, "availability-weekday-error")}
          >
            {WEEKDAYS.map((day) => (
              <NativeSelectOption key={day.value} value={String(day.value)}>
                {day.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id="availability-weekday-error">{errors.weekday}</FieldError>
        </Field>
        <Field data-invalid={errors.label ? true : undefined}>
          <FieldLabel htmlFor="availability-label">What it is</FieldLabel>
          <NativeSelect
            id="availability-label"
            name="label"
            defaultValue={fieldValue(state, "label", "class")}
            {...invalidProps(errors.label, "availability-label-error")}
          >
            {AVAILABILITY_LABELS.map((label) => (
              <NativeSelectOption key={label} value={label}>
                {availabilityLabelLabels[label]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id="availability-label-error">{errors.label}</FieldError>
        </Field>
        <Field data-invalid={errors.start_time ? true : undefined}>
          <FieldLabel htmlFor="availability-start">From (ET)</FieldLabel>
          <Input
            id="availability-start"
            name="start_time"
            type="time"
            step={300}
            required
            defaultValue={fieldValue(state, "start_time")}
            {...invalidProps(errors.start_time, "availability-start-error")}
          />
          <FieldError id="availability-start-error">{errors.start_time}</FieldError>
        </Field>
        <Field data-invalid={errors.end_time ? true : undefined}>
          <FieldLabel htmlFor="availability-end">To (ET)</FieldLabel>
          <Input
            id="availability-end"
            name="end_time"
            type="time"
            step={300}
            required
            defaultValue={fieldValue(state, "end_time")}
            {...invalidProps(errors.end_time, "availability-end-error")}
          />
          <FieldError id="availability-end-error">{errors.end_time}</FieldError>
        </Field>
      </div>
      <Field data-invalid={errors.note ? true : undefined}>
        <FieldLabel htmlFor="availability-note">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input
          id="availability-note"
          name="note"
          maxLength={PEOPLE_LIMITS.availabilityNote}
          placeholder="e.g. ECON 101, or reachable by text"
          defaultValue={fieldValue(state, "note")}
          {...invalidProps(errors.note, "availability-note-error")}
        />
        <FieldError id="availability-note-error">{errors.note}</FieldError>
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Adding…" className="max-sm:w-full">
        <PlusIcon aria-hidden />
        Add busy time
      </SubmitButton>
    </form>
  )
}
