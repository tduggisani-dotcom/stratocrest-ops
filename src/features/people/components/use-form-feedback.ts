import { useEffect, useRef, type RefObject } from "react"
import { toast } from "sonner"
import type { FormState } from "@/lib/forms"

const sameName = (errorKey: string) => errorKey

/**
 * After a Server Action answers a form: toast the success message and put
 * focus back on the submit button, or move focus to the first field with an
 * error (the submit button when the error is for the whole form). `fieldName`
 * maps an error key ("strengths.2") to the input's name ("strength_3") when
 * they differ.
 *
 * Each result is handled once (each action returns a new state object). Next
 * keeps recently visited pages alive in React <Activity>, which re-runs effects
 * every time a page is shown again; the ref survives that, so going Back to a
 * profile doesn't repeat an old toast or pull focus to an old field.
 */
export function useFormFeedback(
  state: FormState,
  formRef: RefObject<HTMLFormElement | null>,
  fieldName: (errorKey: string) => string = sameName,
) {
  const handled = useRef(state)
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state

    const form = formRef.current
    if (state.status === "success") {
      if (state.message) toast.success(state.message)
      form?.querySelector<HTMLElement>('[type="submit"]')?.focus()
    } else if (state.status === "error") {
      // A whole-form error (e.g. a failed request) has no field: the form
      // remounted to refill what was typed, so put focus back on its button.
      const first = Object.keys(state.fieldErrors ?? {})[0]
      const target = first ? `[name="${CSS.escape(fieldName(first))}"]` : '[type="submit"]'
      form?.querySelector<HTMLElement>(target)?.focus()
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
