"use client"

import { useActionState, useRef } from "react"
import { firstNameOf } from "@/components/common/person-chip"
import { FormMessage } from "@/components/forms/form-message"
import { SubmitButton } from "@/components/forms/submit-button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/features/people/actions"
import { withConnectionErrors } from "@/lib/action-calls"
import { CLIFTON_STRENGTH_NAMES } from "@/lib/clifton-strengths"
import { initialFormState } from "@/lib/forms"
import { PEOPLE_LIMITS, STRENGTH_FIELDS, profileFieldName } from "@/lib/schemas/people"
import { fieldValue, formKey, invalidProps, useFormFeedback } from "./use-form-feedback"

export type ProfileFormPerson = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  contactPreference: string | null
  strengths: string[]
  skills: string[]
}

const RANKS = ["1st", "2nd", "3rd", "4th", "5th"] as const

// A request that fails (no signal, server error) keeps what was typed.
const saveProfile = withConnectionErrors(updateProfile)

/**
 * Edit a profile: name, role, photo link, how to reach them, CliftonStrengths
 * top 5 (five ranked pickers, each optional) and skills (comma-separated).
 * Everyone can edit everyone's profile (spec §2).
 */
export function ProfileForm({ person, isMe }: { person: ProfileFormPerson; isMe: boolean }) {
  const [state, formAction] = useActionState(saveProfile, initialFormState)
  const formRef = useRef<HTMLFormElement>(null)
  useFormFeedback(state, formRef, profileFieldName)
  const errors = state.fieldErrors ?? {}
  const strengthsError = errors.strengths
  const firstName = firstNameOf(person.name)

  return (
    <form
      key={formKey(state, person)}
      ref={formRef}
      action={formAction}
      noValidate
      aria-labelledby="edit-profile-heading"
      className="space-y-6"
    >
      <input type="hidden" name="id" value={person.id} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="profile-name">Name</FieldLabel>
          <Input
            id="profile-name"
            name="name"
            required
            maxLength={PEOPLE_LIMITS.name}
            autoComplete={isMe ? "name" : "off"}
            defaultValue={fieldValue(state, "name", person.name)}
            {...invalidProps(errors.name, "profile-name-error")}
          />
          <FieldError id="profile-name-error">{errors.name}</FieldError>
        </Field>
        <Field data-invalid={errors.role ? true : undefined}>
          <FieldLabel htmlFor="profile-role">Role</FieldLabel>
          <Input
            id="profile-role"
            name="role"
            required
            maxLength={PEOPLE_LIMITS.role}
            autoComplete={isMe ? "organization-title" : "off"}
            defaultValue={fieldValue(state, "role", person.role)}
            {...invalidProps(errors.role, "profile-role-error")}
          />
          <FieldError id="profile-role-error">{errors.role}</FieldError>
        </Field>
      </div>

      <Field data-invalid={errors.contact_preference ? true : undefined}>
        <FieldLabel htmlFor="profile-contact">How to reach {isMe ? "me" : firstName}</FieldLabel>
        <Textarea
          id="profile-contact"
          name="contact_preference"
          rows={2}
          maxLength={PEOPLE_LIMITS.contactPreference}
          placeholder="e.g. Text first; email for documents. No calls during class."
          defaultValue={fieldValue(state, "contact_preference", person.contactPreference ?? "")}
          {...invalidProps(
            errors.contact_preference,
            "profile-contact-error",
            "profile-contact-hint",
          )}
        />
        <FieldDescription id="profile-contact-hint">
          Shown on the People page so teammates know the best way to ask for help.
        </FieldDescription>
        <FieldError id="profile-contact-error">{errors.contact_preference}</FieldError>
      </Field>

      <Field data-invalid={errors.avatar_url ? true : undefined}>
        <FieldLabel htmlFor="profile-avatar">
          Photo link <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input
          id="profile-avatar"
          name="avatar_url"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={PEOPLE_LIMITS.avatarUrl}
          placeholder="https://"
          defaultValue={fieldValue(state, "avatar_url", person.avatarUrl ?? "")}
          {...invalidProps(errors.avatar_url, "profile-avatar-error", "profile-avatar-hint")}
        />
        <FieldDescription id="profile-avatar-hint">
          A link to a square photo that starts with https://. Leave it empty to show initials.
        </FieldDescription>
        <FieldError id="profile-avatar-error">{errors.avatar_url}</FieldError>
      </Field>

      <FieldSet
        className="gap-4"
        aria-describedby={
          strengthsError
            ? "profile-strengths-hint profile-strengths-error"
            : "profile-strengths-hint"
        }
      >
        <FieldLegend>CliftonStrengths top 5</FieldLegend>
        <FieldDescription id="profile-strengths-hint" className="-mt-2">
          Pick them in rank order. Leave the rest empty if you don&apos;t know them yet.
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STRENGTH_FIELDS.map((field, index) => {
            const saved = person.strengths[index] ?? ""
            const value = fieldValue(state, field, saved)
            const error = errors[`strengths.${index}`]
            const errorId = `profile-${field}-error`
            // Keep a stored value that isn't in the list visible (validation will flag it).
            const unknown = value !== "" && !CLIFTON_STRENGTH_NAMES.some((name) => name === value)
            return (
              <Field key={field} data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor={`profile-${field}`}>{RANKS[index]}</FieldLabel>
                <NativeSelect
                  id={`profile-${field}`}
                  name={field}
                  defaultValue={value}
                  {...invalidProps(error, errorId)}
                >
                  <NativeSelectOption value="">Not set</NativeSelectOption>
                  {unknown ? <NativeSelectOption value={value}>{value}</NativeSelectOption> : null}
                  {CLIFTON_STRENGTH_NAMES.map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id={errorId}>{error}</FieldError>
              </Field>
            )
          })}
        </div>
        <FieldError id="profile-strengths-error">{strengthsError}</FieldError>
      </FieldSet>

      <Field data-invalid={errors.skills ? true : undefined}>
        <FieldLabel htmlFor="profile-skills">Skills</FieldLabel>
        <Input
          id="profile-skills"
          name="skills"
          autoCapitalize="none"
          placeholder="e.g. CAD, grant writing, Python"
          defaultValue={fieldValue(state, "skills", person.skills.join(", "))}
          {...invalidProps(errors.skills, "profile-skills-error", "profile-skills-hint")}
        />
        <FieldDescription id="profile-skills-hint">
          Separate skills with commas (up to {PEOPLE_LIMITS.skills}).
        </FieldDescription>
        <FieldError id="profile-skills-error">{errors.skills}</FieldError>
      </Field>

      <FormMessage state={state} />
      <SubmitButton className="max-sm:w-full">Save profile</SubmitButton>
    </form>
  )
}
