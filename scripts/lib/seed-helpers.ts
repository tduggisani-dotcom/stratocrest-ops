import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { TeamEmail } from "../../src/lib/team-emails.ts"
import type { Database } from "../../src/types/database.ts"
import type { TeamMember } from "../data/team.ts"

/**
 * Small helpers shared by scripts/seed.ts and scripts/seed-demo.ts.
 * These run under plain Node type stripping: relative imports with .ts
 * extensions, "import type" for types, no path aliases.
 */

export type SeedClient = SupabaseClient<Database>
type Env = Record<string, string | undefined>

/** Reads required settings, or throws one error that lists everything missing. */
export function readEnv<const N extends string>(
  names: readonly N[],
  env: Env = process.env,
): Record<N, string> {
  const missing = names.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")}. Add ${missing.length === 1 ? "it" : "them"} to .env.local ` +
        "(see .env.example and docs/SETUP.md).",
    )
  }
  return Object.fromEntries(names.map((name) => [name, env[name]!.trim()])) as Record<N, string>
}

/** "john@example.com" → "j***@example.com", so logs never show a full address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return "***"
  return `${email[0]}***${email.slice(at)}`
}

/** A Supabase client with the secret key (bypasses RLS). Acts as "system". */
export function createSeedClient(url: string, secretKey: string): SeedClient {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Pairs each TEAM_EMAILS entry with its teammate by exact name, in team order. */
export function matchTeamEmails(
  entries: readonly TeamEmail[],
  team: readonly TeamMember[],
): Array<TeamMember & { email: string }> {
  const names = team.map((member) => member.name)
  const unknown = entries.filter((entry) => !names.includes(entry.name))
  if (unknown.length > 0) {
    throw new Error(
      `TEAM_EMAILS has ${unknown.map((entry) => `"${entry.name}"`).join(", ")}, not on the team ` +
        `list in scripts/data/team.ts. Use these exact names: ${names.join(", ")}.`,
    )
  }
  const missing = names.filter((name) => !entries.some((entry) => entry.name === name))
  if (missing.length > 0) {
    throw new Error(`TEAM_EMAILS is missing ${missing.join(", ")}. Add each as Name <email>.`)
  }
  return team.map((member) => ({
    ...member,
    email: entries.find((entry) => entry.name === member.name)!.email,
  }))
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Why seed:demo must not run against this project, or null when it may.
 * Demo data is for the local stack only: never production, and never a remote
 * project unless ALLOW_REMOTE_DEMO=1 (for the dev project, on purpose).
 */
export function demoSeedBlockReason(env: Env = process.env): string | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  if (env.APP_ENV?.trim() === "production") {
    return "APP_ENV is production. Demo data never goes into production."
  }
  const prodRef = env.PROD_SUPABASE_PROJECT_REF?.trim()
  if (prodRef && url.includes(prodRef)) {
    return "NEXT_PUBLIC_SUPABASE_URL points at the production project (PROD_SUPABASE_PROJECT_REF)."
  }
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL is missing or not a URL."
  }
  if (!LOCAL_HOSTS.has(host) && env.ALLOW_REMOTE_DEMO !== "1") {
    return (
      `NEXT_PUBLIC_SUPABASE_URL is not the local stack (${host}). ` +
      "Set ALLOW_REMOTE_DEMO=1 to load demo data into a remote dev project on purpose."
    )
  }
  return null
}

type SupabaseResult = { data: unknown; error: { message: string } | null }

/** Throws with context when a Supabase call failed; returns its data otherwise. */
export function check<R extends SupabaseResult>(
  result: R,
  what: string,
): Extract<R, { error: null }>["data"] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data
}

/** Runs a script's main(), printing a readable error and exiting 1 on failure. */
export async function runScript(name: string, main: () => Promise<void>): Promise<void> {
  try {
    await main()
  } catch (error) {
    console.error(`\n${name} failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
