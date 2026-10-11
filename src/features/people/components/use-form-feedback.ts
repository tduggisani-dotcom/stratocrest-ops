import { useEffect, type RefObject } from "react"
import { toast } from "sonner"
import type { FormState } from "@/lib/forms"

const sameName = (errorKey: string) => errorKey

/**
 * After a Server Action answers a form: toast the success message and put
 * focus back on the submit button, or move focus to the first field with an
 * error. `fieldName` maps an error key ("strengths.2") to the input's name
 * ("strength_3") when they differ; pass a module-level function so the effect
 * runs once per result (each action returns a new state object).
 */
export function useFormFeedback(
  state: FormState,
  formRef: RefObject<HTMLFormElement | null>,
  fieldName: (errorKey: string) => string = sameName,
) {
  useEffect(() => {
    const form = formRef.current
    if (state.status === "success") {
      if (state.message) toast.success(state.message)
      form?.querySelector<HTMLElement>('[type="submit"]')?.focus()
    } else if (state.status === "error") {
      const first = Object.keys(state.fieldErrors ?? {})[0]
      if (!first || !form) return
      form.querySelector<HTMLElement>(`[name="${CSS.escape(fieldName(first))}"]`)?.focus()
    }
  }, [state, formRef, fieldName])
}

/**
 * A key for a form that changes whenever its inputs must start from new
 * defaults. React resets a form after its action runs, and a <select> resets to
 * the option it had when it mounted, so after an error (refill what was typed)
 * or a save that changed the stored values, the form remounts with a new key.
 */
export function formKey(state: FormState, savedValues: unknown = null): string {
  return state.status === "error"
    ? `error:${JSON.stringify(state.values ?? {})}`
    : `saved:${JSON.stringify(savedValues)}`
}

/** What to put back in a field: what was typed (after an error) or the saved value. */
export function fieldValue(state: FormState, name: string, saved = ""): string {
  return state.status === "error" ? (state.values?.[name] ?? "") : saved
}

/** aria props for an input whose inline error has id `errorId` (plus an optional hint id). */
export function invalidProps(error: string | undefined, errorId: string, hintId?: string) {
  const ids = [hintId, error ? errorId : undefined].filter(Boolean).join(" ")
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const
}
