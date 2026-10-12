"use server"

import type { Route } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isActiveTeamEmail } from "@/features/auth/allowlist"
import { AUTH_MESSAGES, sendCodeErrorMessage, verifyErrorMessage } from "@/features/auth/errors"
import type { RequestCodeState, VerifyState } from "@/features/auth/form-state"
import { getCurrentPerson } from "@/lib/auth"
import { getPublicEnv } from "@/lib/env"
import {
  confirmLinkSchema,
  confirmRedirectUrl,
  requestCodeSchema,
  verifyCodeSchema,
} from "@/lib/schemas/auth"
import { createClient } from "@/lib/supabase/server"

/**
 * Sign-in Server Actions. Each one is a public endpoint, so each validates its
 * own input; Supabase rate-limits the sends and verifications.
 */

/** Step 1 and "Resend code": email an active teammate a 6-digit code and a link. */
export async function requestCode(
  prev: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const rawEmail = formData.get("email")
  const parsed = requestCodeSchema.safeParse({ email: rawEmail, next: formData.get("next") })
  if (!parsed.success) {
    return {
      step: "email",
      email: typeof rawEmail === "string" ? rawEmail : "",
      error: parsed.error.issues[0]?.message ?? AUTH_MESSAGES.sendFailed,
    }
  }

  const { email, next } = parsed.data
  const resend = formData.get("intent") === "resend"
  // A failed resend keeps the code step (and the code typed so far) on screen.
  const failed = (error: string): RequestCodeState =>
    resend ? { step: "code", email, error, sentAt: prev.sentAt } : { step: "email", email, error }

  try {
    if (!(await isActiveTeamEmail(email))) {
      return { step: "email", email, error: AUTH_MESSAGES.notOnTeam }
    }
  } catch (error) {
    console.error(error)
    return failed(AUTH_MESSAGES.unavailable)
  }

  // The SSR client (not the admin one) so Supabase's sign-in cookies land on this browser.
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmRedirectUrl(await siteUrl(), next),
    },
  })
  if (error) {
    console.error("Sending the sign-in code failed", { status: error.status, code: error.code })
    return failed(sendCodeErrorMessage(error))
  }

  return {
    step: "code",
    email,
    notice: resend ? `We sent a new code to ${email}.` : undefined,
    sentAt: Date.now(),
  }
}

/** Step 2: check the typed code, then go to `next`. Returns only on failure. */
export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = verifyCodeSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    next: formData.get("next"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? AUTH_MESSAGES.badCode }

  const { email, code, next } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" })
  if (error) return { error: verifyErrorMessage(error, "code") }

  return finishSignIn(supabase, next)
}

/**
 * The emailed link, after the person presses "Sign in" on /auth/confirm.
 * Never run on page load: email scanners open links and would use them up.
 */
export async function confirmSignIn(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = confirmLinkSchema.safeParse({
    token_hash: formData.get("token_hash"),
    type: formData.get("type"),
    next: formData.get("next"),
  })
  if (!parsed.success) return { error: AUTH_MESSAGES.badLink }

  const { token_hash, type, next } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash, type })
  if (error) return { error: verifyErrorMessage(error, "link") }

  return finishSignIn(supabase, next)
}

/** Signs out on this device only and goes to /sign-in. Use as `<form action={signOut}>`. */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "local" })
  redirect("/sign-in")
}

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * After a successful verify, only active teammates stay signed in. Someone with
 * a login but no active `people` row (deactivated, or a stray account) is
 * signed out everywhere and told why.
 */
async function finishSignIn(supabase: ServerClient, next: Route): Promise<never> {
  // getCurrentPerson() reads the session cookies verifyOtp just set on this action.
  let person: Awaited<ReturnType<typeof getCurrentPerson>>
  try {
    person = await getCurrentPerson()
  } catch {
    // Couldn't check right now (a database blip). Stay signed in: the page checks again.
    redirect(next)
  }
  if (!person) {
    await supabase.auth.signOut({ scope: "global" })
    redirect("/sign-in?reason=not-on-team")
  }
  redirect(next)
}

/** The app's address for links in emails: NEXT_PUBLIC_SITE_URL, else this request's origin. */
async function siteUrl(): Promise<string> {
  const configured = getPublicEnv().siteUrl
  if (configured) return configured

  const requestHeaders = await headers()
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https"
  const candidates = [requestHeaders.get("origin"), host ? `${proto}://${host}` : null]
  for (const candidate of candidates) {
    const origin = httpOrigin(candidate)
    if (origin) return origin
  }
  return "http://localhost:3000"
}

function httpOrigin(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined
  } catch {
    return undefined
  }
}
