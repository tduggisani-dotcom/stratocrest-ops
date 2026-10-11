import type { z } from "zod"

/**
 * What a form's Server Action returns to `useActionState`. Forms are
 * `<form action={…}>` elements validated on the server with the same Zod schema
 * the bot API uses. Wrap the action with `withConnectionErrors`
 * (src/lib/action-calls.ts) so a failed request keeps what was typed.
 */
export type FormState<Field extends string = string> = {
  status: "idle" | "error" | "success"
  /** A message for the whole form, shown above the submit button. */
  message?: string
  /** First error per field, keyed by the form field's `name`. */
  fieldErrors?: Partial<Record<Field, string>>
  /** What was submitted, to refill uncontrolled inputs after an error. */
  values?: Record<string, string>
  /** Non-blocking notes, e.g. "the due date falls in Sam's crunch period". */
  warnings?: string[]
  /** The id of a record the action created. */
  id?: string
}

export const initialFormState: FormState = { status: "idle" }

/** First message per field from a Zod error, keyed by the dotted path ("owner_id", "links.org"). */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form"
    errors[key] ??= issue.message
  }
  return errors
}

/** The string entries of a FormData, for refilling a form after an error. Files are skipped. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !(key in values)) values[key] = value
  }
  return values
}

/** An empty form field ("") becomes undefined, so optional schema fields read as missing. */
export function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}
