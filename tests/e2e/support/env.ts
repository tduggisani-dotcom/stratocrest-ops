import { existsSync } from "node:fs"
import path from "node:path"

/**
 * Settings for the end-to-end tests. Locally they come from .env.local (the same file the app
 * reads); in CI the workflow exports them. Values already in the environment win.
 */
const envFile = path.resolve(import.meta.dirname, "../../../.env.local")
if (existsSync(envFile)) process.loadEnvFile(envFile)

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Start the local stack (pnpm db:start) and copy its values into .env.local.`,
    )
  }
  return value
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL")
export const SUPABASE_SECRET_KEY = required("SUPABASE_SECRET_KEY")
/** Supabase's local test mailbox (Mailpit). */
export const MAILPIT_URL = (process.env.MAILPIT_URL || "http://127.0.0.1:54324").replace(/\/$/, "")
/** Set to a folder to save screenshots of key screens while the tests run. */
export const SCREENSHOTS_DIR = process.env.E2E_SCREENSHOTS_DIR || undefined
