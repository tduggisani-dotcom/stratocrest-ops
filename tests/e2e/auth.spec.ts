import { expect, test } from "@playwright/test"
import { AUTH_MESSAGES } from "@/features/auth/errors"
import {
  enterCode,
  hasSessionCookie,
  requestCode,
  requestCodeEmail,
  signedOut,
  signInWithCode,
} from "./support/auth"
import { deleteEmailsTo, emailsTo, waitForSignInEmail } from "./support/mailpit"
import { snap } from "./support/page"
import { inactiveCandidate, setActive, teammateFor } from "./support/team"

/**
 * Sign-in and sign-out, starting signed out, by the real flow (codes come from Mailpit).
 * Each flow signs in as its own teammate (support/team.ts), never the saved-session one.
 */
test.use({ storageState: signedOut })

test("a signed-out visit to a section redirects to sign-in and keeps where you were going", async ({
  page,
}, testInfo) => {
  await page.goto("/tasks")
  await expect(page).toHaveURL("/sign-in?next=%2Ftasks")
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await snap(page, testInfo, "sign-in")
})

test("an email that isn't on the team gets the not-on-team message and no email", async ({
  page,
}) => {
  const stranger = `not-on-team-${Date.now()}@example.com`
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(stranger)
  await page.getByRole("button", { name: "Email me a code" }).click()

  await expect(page.getByText(AUTH_MESSAGES.notOnTeam)).toBeVisible()
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByRole("heading", { name: "Check your email" })).toHaveCount(0)
  // Give a stray email time to arrive before checking that none did.
  await page.waitForTimeout(1_000)
  expect(await emailsTo(stranger)).toEqual([])
})

test("signing in with the emailed code lands on This Week with a greeting", async ({
  page,
}, testInfo) => {
  const person = await teammateFor(testInfo.project.name, "code")
  await page.goto("/sign-in")
  const mail = await requestCodeEmail(page, person.email)
  expect(mail.subject).toBe("Your StratoCrest Ops sign-in code")
  await expect(page.getByText(person.email)).toBeVisible()
  await expect(page.getByLabel("6-digit code")).toBeFocused()
  await snap(page, testInfo, "sign-in-code-step")

  await enterCode(page, mail.code)
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hi, ${person.firstName}`)
  expect(await hasSessionCookie(page)).toBe(true)
  await deleteEmailsTo(person.email)
})

test("the emailed link signs in only after the button is pressed, then honors next", async ({
  page,
  browser,
}, testInfo) => {
  const person = await teammateFor(testInfo.project.name, "link")
  await page.goto("/tasks")
  await expect(page).toHaveURL("/sign-in?next=%2Ftasks")
  const mail = await requestCodeEmail(page, person.email)

  const link = new URL(mail.link)
  expect(link.origin).toBe(new URL(page.url()).origin)
  expect(link.pathname).toBe("/auth/confirm")
  expect(link.searchParams.get("next")).toBe("/tasks")
  expect(link.searchParams.get("type")).toBe("email")
  expect(link.searchParams.get("token_hash")).toBeTruthy()

  // Open the link in a separate browser, as a phone would from its mail app.
  const other = await browser.newContext({ ...signedOut, baseURL: testInfo.project.use.baseURL })
  try {
    const linkPage = await other.newPage()
    await linkPage.goto(mail.link)
    await expect(linkPage.getByRole("heading", { name: "Finish signing in" })).toBeVisible()
    const button = linkPage.getByRole("button", { name: "Sign in to StratoCrest Ops" })
    await expect(button).toBeVisible()
    await snap(linkPage, testInfo, "auth-confirm")

    // Opening the link (as an email scanner would) didn't sign anyone in.
    await linkPage.reload()
    expect(await hasSessionCookie(linkPage)).toBe(false)
    const probe = await other.newPage()
    await probe.goto("/tasks")
    await expect(probe).toHaveURL("/sign-in?next=%2Ftasks")
    await probe.close()

    // ...and didn't use the link up: the button still works, and lands where they were going.
    await button.click()
    await expect(linkPage).toHaveURL("/tasks")
    await expect(linkPage.getByRole("heading", { level: 1 })).toHaveText("Tasks")
    expect(await hasSessionCookie(linkPage)).toBe(true)
  } finally {
    await other.close()
    await deleteEmailsTo(person.email)
  }
})

test("signing out returns to sign-in, and protected pages redirect again", async ({
  page,
}, testInfo) => {
  const person = await teammateFor(testInfo.project.name, "signOut")
  await signInWithCode(page, person.email)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hi, ${person.firstName}`)

  await page.getByRole("button", { name: /account menu/i }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL("/sign-in")
  await expect(page.getByLabel("Email")).toBeVisible()
  expect(await hasSessionCookie(page)).toBe(false)

  for (const path of ["/", "/tasks", "/settings"]) {
    await page.goto(path)
    await expect(page).toHaveURL(
      path === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(path)}`,
    )
  }
})

test("an inactive teammate can't sign in", async ({ page }) => {
  const person = await inactiveCandidate()
  await deleteEmailsTo(person.email)

  // 1. Switched off before asking for a code: told they're not on the team, and no email.
  await setActive(person.id, false)
  try {
    await page.goto("/sign-in")
    await page.getByLabel("Email").fill(person.email)
    await page.getByRole("button", { name: "Email me a code" }).click()
    await expect(page.getByText(AUTH_MESSAGES.notOnTeam)).toBeVisible()
    await page.waitForTimeout(1_000)
    expect(await emailsTo(person.email)).toEqual([])
  } finally {
    await setActive(person.id, true)
  }

  // 2. Switched off after the code was sent: the valid code still doesn't let them in.
  await page.goto("/sign-in")
  await requestCode(page, person.email)
  const mail = await waitForSignInEmail(person.email)
  await setActive(person.id, false)
  try {
    await enterCode(page, mail.code)
    await expect(page).toHaveURL("/sign-in?reason=not-on-team")
    await expect(page.getByText("Your account isn't active on the StratoCrest team.")).toBeVisible()
    expect(await hasSessionCookie(page)).toBe(false)
    await page.goto("/tasks")
    await expect(page).toHaveURL("/sign-in?next=%2Ftasks")
  } finally {
    await setActive(person.id, true)
    await deleteEmailsTo(person.email)
  }
})

test("deactivating a signed-in teammate locks them out at once", async ({ page }) => {
  const person = await inactiveCandidate()
  await signInWithCode(page, person.email)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hi, ${person.firstName}`)

  await setActive(person.id, false)
  try {
    for (const path of ["/", "/tasks"]) {
      await page.goto(path)
      await expect(page).toHaveURL("/sign-in?reason=not-on-team")
      await expect(page.getByText("isn't active on the StratoCrest team")).toBeVisible()
      await expect(page.getByLabel("Email")).toBeVisible()
      await expect(page.getByText(`Hi, ${person.firstName}`)).toHaveCount(0)
    }
  } finally {
    await setActive(person.id, true)
  }
})

test("Resend code sends a new code, and only the newest one works", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Sends two emails; once per run is enough")
  const person = await teammateFor(testInfo.project.name, "code")
  await page.goto("/sign-in")
  const first = await requestCodeEmail(page, person.email)

  await deleteEmailsTo(person.email)
  // Supabase refuses a second email to one address within max_frequency (1 s locally).
  await page.waitForTimeout(1_500)
  await page.getByRole("button", { name: "Resend code" }).click()
  await expect(page.getByText(`We sent a new code to ${person.email}.`)).toBeVisible()
  const second = await waitForSignInEmail(person.email)
  expect(second.id).not.toBe(first.id)

  // The first code no longer works (unless, rarely, both codes are the same).
  if (first.code !== second.code) {
    await enterCode(page, first.code)
    await expect(page.getByText(AUTH_MESSAGES.badCode)).toBeVisible()
    await expect(page.getByLabel("6-digit code")).toBeFocused()
  }
  await enterCode(page, second.code)
  await expect(page).toHaveURL("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Hi, ${person.firstName}`)
  await deleteEmailsTo(person.email)
})
