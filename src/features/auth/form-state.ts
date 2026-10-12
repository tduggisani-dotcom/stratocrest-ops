/**
 * Shapes returned by the sign-in Server Actions to useActionState.
 * Kept out of actions.ts because a "use server" file may only export async functions.
 */

export type RequestCodeState = {
  /** Which step to show: the email form, or "check your email" + code. */
  step: "email" | "code"
  /** Echoed back so the email field keeps its value after an error. */
  email: string
  /** Problem with the email or with sending (shown on the current step). */
  error?: string
  /** Good news worth announcing, e.g. after "Resend code". */
  notice?: string
  /** When the newest code was sent (ms). A new value resets the code form. */
  sentAt?: number
}

export const initialRequestCodeState: RequestCodeState = { step: "email", email: "" }

/** verifyCode and confirmSignIn redirect on success, so they only ever return errors. */
export type VerifyState = { error?: string }

export const initialVerifyState: VerifyState = {}
