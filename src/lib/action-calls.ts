import { unstable_rethrow } from "next/navigation"
import { formValues, type FormState } from "@/lib/forms"

/**
 * Calling Server Actions from client components.
 *
 * A Server Action call can reject: the phone lost signal (the fetch fails) or
 * the server threw (e.g. the session check couldn't reach Supabase). React
 * sends a rejection inside a transition or `useActionState` to the nearest
 * error boundary, which replaces the whole page and loses what was typed.
 * These helpers turn a rejection into the normal error UI instead. Next's own
 * control flow (redirect to sign-in, notFound) still goes through.
 */

export const CONNECTION_ERROR = "Couldn't reach the server. Check your connection and try again."

/** Runs `call`; if it rejects, logs the error and returns `fallback`. */
export async function callAction<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call()
  } catch (error) {
    unstable_rethrow(error)
    console.error("A server request failed", error)
    return fallback
  }
}

/**
 * Wraps a form's Server Action for `useActionState`. A failed call returns an
 * error state with what was submitted, so the form refills instead of being
 * replaced by the error screen.
 */
export function withConnectionErrors<State extends FormState>(
  action: (previous: State, formData: FormData) => Promise<State>,
): (previous: State, formData: FormData) => Promise<State> {
  return (previous, formData) =>
    callAction(() => action(previous, formData), {
      ...previous,
      status: "error",
      message: CONNECTION_ERROR,
      fieldErrors: {},
      warnings: [],
      values: formValues(formData),
    })
}
