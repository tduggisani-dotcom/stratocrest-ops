import type { AuthError } from "@supabase/supabase-js"

/** What people see when signing in goes wrong. Plain words, one next step each. */
export const AUTH_MESSAGES = {
  notOnTeam: "That email isn't on the StratoCrest team list. Ask a teammate to add you.",
  rateLimited: "Too many attempts. Wait a minute and try again.",
  noLogin: "Your sign-in isn't set up yet. Ask a teammate to add you again.",
  emailNotSetUp: "Sign-in emails can't reach this address yet. See docs/SETUP.md, Part B.",
  sendFailed: "We couldn't send the email. Try again in a minute.",
  badCode: "That code didn't work. Check the newest email, or send a new code.",
  badLink: "This sign-in link has expired or was already used. Get a new code to sign in.",
  unavailable: "Sign-in isn't working right now. Try again in a minute.",
} as const

type AuthErrorLike = Pick<AuthError, "status" | "code">

export function isRateLimited(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  )
}

/** For errors from signInWithOtp (sending the code). */
export function sendCodeErrorMessage(error: AuthErrorLike): string {
  if (isRateLimited(error)) return AUTH_MESSAGES.rateLimited
  switch (error.code) {
    // Active in `people` but no login yet; sign-ups are off, so Supabase won't create one.
    case "otp_disabled":
    case "signup_disabled":
    case "user_not_found":
      return AUTH_MESSAGES.noLogin
    // Supabase's built-in email only sends to project members (no custom SMTP yet).
    case "email_address_not_authorized":
      return AUTH_MESSAGES.emailNotSetUp
    default:
      return error.status !== undefined && error.status < 500
        ? AUTH_MESSAGES.sendFailed
        : AUTH_MESSAGES.unavailable
  }
}

/** For errors from verifyOtp, typed code or emailed link. */
export function verifyErrorMessage(error: AuthErrorLike, via: "code" | "link"): string {
  if (isRateLimited(error)) return AUTH_MESSAGES.rateLimited
  if (error.status === undefined || error.status >= 500) return AUTH_MESSAGES.unavailable
  // Wrong, expired or already-used token: Supabase answers 403 otp_expired for all three.
  return via === "code" ? AUTH_MESSAGES.badCode : AUTH_MESSAGES.badLink
}
