import { MAILPIT_URL } from "./env"

/**
 * Reads sign-in emails from Supabase's local test mailbox (Mailpit) over its HTTP API:
 * https://mailpit.axllent.org/docs/api-v1/
 */

type MessageSummary = {
  ID: string
  Subject: string
  Created: string
  To: { Name: string; Address: string }[]
}

type SearchResult = { messages: MessageSummary[] }
type Message = { ID: string; Subject: string; Text: string; HTML: string }

export type SignInEmail = {
  id: string
  subject: string
  /** The 6-digit code. */
  code: string
  /** The "Sign in to StratoCrest Ops" button's address. */
  link: string
}

async function api<T>(pathAndQuery: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/${pathAndQuery}`, init)
  if (!response.ok) {
    throw new Error(`Mailpit ${init?.method ?? "GET"} ${pathAndQuery}: HTTP ${response.status}`)
  }
  // Deletes answer with a plain "ok".
  const json = response.headers.get("content-type")?.includes("application/json")
  return (json ? await response.json() : undefined) as T
}

const toQuery = (email: string) => encodeURIComponent(`to:"${email}"`)

/** Every email to `email`, newest first. */
export async function emailsTo(email: string): Promise<MessageSummary[]> {
  const result = await api<SearchResult>(`search?query=${toQuery(email)}&limit=50`)
  // Search matches on substrings; keep exact recipients only.
  return result.messages.filter((m) =>
    m.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
  )
}

/** Delete every email to `email` (before a flow, so the next one found is new). */
export async function deleteEmailsTo(email: string): Promise<void> {
  await api(`search?query=${toQuery(email)}`, { method: "DELETE" })
}

/** Wait for a sign-in email to `email`, then read its code and link. */
export async function waitForSignInEmail(
  email: string,
  { timeout = 15_000 }: { timeout?: number } = {},
): Promise<SignInEmail> {
  const deadline = Date.now() + timeout
  for (;;) {
    const [newest] = await emailsTo(email)
    if (newest) return readSignInEmail(newest.ID)
    if (Date.now() > deadline) {
      throw new Error(
        `No sign-in email reached ${email} within ${timeout / 1000} s (${MAILPIT_URL})`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

async function readSignInEmail(id: string): Promise<SignInEmail> {
  const message = await api<Message>(`message/${id}`)
  const code = /\b(\d{6})\b/.exec(message.Text)?.[1]
  const href = /<a\b[^>]*\bhref="([^"]+)"[^>]*>\s*Sign in to StratoCrest Ops/i.exec(
    message.HTML,
  )?.[1]
  if (!code || !href) {
    throw new Error(`Email ${id} ("${message.Subject}") has no 6-digit code or sign-in button`)
  }
  return { id, subject: message.Subject, code, link: decodeHtml(href) }
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}
