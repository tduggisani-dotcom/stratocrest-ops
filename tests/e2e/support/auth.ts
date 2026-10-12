import { expect, type Page } from "@playwright/test"
import { deleteEmailsTo, waitForSignInEmail, type SignInEmail } from "./mailpit"

/**
 * Sign-in by the real flow: email on /sign-in → read the email in Mailpit → type the code.
 * Supabase rate-limits sign-in emails, so most specs reuse the signed-in state that
 * global-setup.ts saves, and each flow that sends an email uses its own teammate.
 */

/** Browser state with nobody signed in, for `test.use({ storageState: signedOut })`. */
export const signedOut = { cookies: [], origins: [] }

/**
 * Supabase sends one sign-in email per address per `max_frequency` (1 s locally, 60 s hosted)
 * and answers a quicker second request with "Too many attempts". Tests that email the same
 * teammate back to back wait out that gap instead of racing it.
 */
const MIN_EMAIL_GAP_MS = 1_500
const lastEmailedAt = new Map<string, number>()

/** On /sign-in: fill the email and send the code. Leaves the page on the "Check your email" step. */
export async function requestCode(page: Page, email: string): Promise<void> {
  const wait = (lastEmailedAt.get(email) ?? 0) + MIN_EMAIL_GAP_MS - Date.now()
  if (wait > 0) await page.waitForTimeout(wait)
  lastEmailedAt.set(email, Date.now())
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Email me a code" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
}

/** Type the code and press "Sign in". */
export async function enterCode(page: Page, code: string): Promise<void> {
  await page.getByLabel("6-digit code").fill(code)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
}

/**
 * Request a code for `email` from the page's current sign-in form and return the email that
 * arrives. Old emails to the address are cleared first, so this is always the new one.
 */
export async function requestCodeEmail(page: Page, email: string): Promise<SignInEmail> {
  await deleteEmailsTo(email)
  await requestCode(page, email)
  return waitForSignInEmail(email)
}

/**
 * Sign in from scratch with the emailed code, starting at `path` (a protected page redirects
 * to /sign-in?next=…). Resolves once the app has navigated away from /sign-in.
 */
export async function signInWithCode(page: Page, email: string, path = "/sign-in") {
  await page.goto(path)
  await expect(page).toHaveURL(/\/sign-in/)
  const mail = await requestCodeEmail(page, email)
  await enterCode(page, mail.code)
  await expect(page).not.toHaveURL(/\/sign-in/)
  await deleteEmailsTo(email)
}

/** True when the browser holds a Supabase session cookie. */
export async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies()
  return cookies.some((c) => /^sb-.+-auth-token/.test(c.name))
}
