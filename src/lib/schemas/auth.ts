import type { Route } from "next"
import { z } from "zod"

/**
 * Sign-in: email → 6-digit code, or the link in the same email.
 * Used by the forms and Server Actions in src/features/auth/.
 */

/** Where people land after signing in when there's no usable `next`. */
export const DEFAULT_NEXT_PATH: Route = "/"

const MAX_NEXT_LENGTH = 2048
const CONTROL_CHARS = /\p{Cc}/u

/**
 * A same-site path to go to after signing in, or "/".
 * Only relative paths like "/tasks?view=mine" pass. Anything a browser could
 * read as another site ("//evil.com", "/\evil.com", "https://…") is replaced.
 * Control characters are refused too: browsers drop tabs and newlines inside
 * URLs, so "/\t/evil.com" would turn into "//evil.com".
 * Typed as a Route so redirect() accepts it (it may still be a 404 path).
 */
export function safeNextPath(value: unknown): Route {
  if (typeof value !== "string" || value.length > MAX_NEXT_LENGTH) return DEFAULT_NEXT_PATH
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_NEXT_PATH
  }
  if (CONTROL_CHARS.test(value)) return DEFAULT_NEXT_PATH
  return value as Route
}

/**
 * Accepts anything (a form field, a search param) and returns a safe path.
 * `.optional()` lets the key be missing inside z.object().
 */
export const nextPathSchema = z.unknown().optional().transform(safeNextPath)

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .pipe(z.email({ error: "Enter a full email address, like name@company.com." }))

export const OTP_LENGTH = 6

/** The 6-digit code from the email. Spaces and dashes from a paste are ignored. */
export const otpCodeSchema = z
  .string({ error: "Enter the 6-digit code from the email." })
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email."))

export const requestCodeSchema = z.object({ email: emailSchema, next: nextPathSchema })

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  next: nextPathSchema,
})

/**
 * The email link's query: /auth/confirm?next=…&token_hash=…&type=email.
 * Supabase's token hash is hex, sometimes with a "pkce_" prefix.
 */
export const confirmLinkSchema = z.object({
  token_hash: z.string().regex(/^[\w-]{16,256}$/),
  type: z.enum(["email"]),
  next: nextPathSchema,
})

/**
 * The `emailRedirectTo` for signInWithOtp. Supabase puts it in the email as
 * RedirectTo, and supabase/templates/magic_link.html appends
 * "&token_hash=…&type=email". So it always carries "?next=…", even for "/".
 */
export function confirmRedirectUrl(siteUrl: string, next: string): string {
  const url = new URL("/auth/confirm", siteUrl)
  url.searchParams.set("next", safeNextPath(next))
  return url.toString()
}

/** Why someone was sent to /sign-in (the `reason` search param). */
export const SIGN_IN_REASONS = ["signed-out", "not-on-team"] as const
export type SignInReason = (typeof SIGN_IN_REASONS)[number]
export const signInReasonSchema = z.enum(SIGN_IN_REASONS)

/** Unknown or missing reasons are ignored. */
export function parseSignInReason(value: unknown): SignInReason | undefined {
  const result = signInReasonSchema.safeParse(value)
  return result.success ? result.data : undefined
}
