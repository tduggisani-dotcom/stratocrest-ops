import "server-only"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in person (Row Level Security applies).
 *
 * Reads cookies, so with Cache Components it must run inside a <Suspense>
 * boundary (or a Server Action / Route Handler).
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv()

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, which can't set cookies.
          // src/proxy.ts refreshes the session on every request instead.
        }
      },
    },
  })
}
