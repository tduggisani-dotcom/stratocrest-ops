import { createBrowserClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/** Supabase client for Client Components (Realtime, client-side auth calls). */
export function createClient() {
  if (!client) {
    const { supabaseUrl, supabasePublishableKey } = getPublicEnv()
    client = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)
  }
  return client
}
