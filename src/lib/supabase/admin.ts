import "server-only"
import { createClient } from "@supabase/supabase-js"
import { getPublicEnv } from "@/lib/env"
import { getServerEnv } from "@/lib/env.server"
import type { Database } from "@/types/database"

/**
 * Supabase client with the SECRET key: bypasses Row Level Security.
 * Server-only. Use it only after checking who is asking (requireTeamMember()
 * or a valid bot API key), and pass `actorId` so the audit log records them:
 * the database trusts the `x-actor-id` header only on secret-key requests.
 */
export function createAdminClient(options: { actorId?: string } = {}) {
  const { supabaseUrl } = getPublicEnv()
  const { supabaseSecretKey } = getServerEnv()

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: options.actorId ? { "x-actor-id": options.actorId } : {} },
  })
}
