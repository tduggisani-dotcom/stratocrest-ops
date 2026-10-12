import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * True when `email` belongs to an active teammate. The `people` table is the
 * sign-in allowlist (docs/ARCHITECTURE.md §3), so a new teammate can sign in
 * without a redeploy and a deactivated one can't. Uses the secret key because
 * nobody is signed in yet; it only answers yes or no.
 */
export async function isActiveTeamEmail(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("people")
    .select("id")
    .eq("email", email) // citext: case-insensitive
    .eq("is_active", true)
    .maybeSingle()

  if (error) throw new Error(`Team allowlist lookup failed: ${error.message}`)
  return data !== null
}
