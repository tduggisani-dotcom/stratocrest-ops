import "server-only"
import { cookies } from "next/headers"
import { connection } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in person (Row Level Security applies).
 *
 * Reads cookies and waits for a real request (`connection()`), so with Cache
 * Components it must run inside a <Suspense> boundary (or a Server Action /
 * Route Handler).
 */
export async function createClient() {
  const cookieStore = await cookies()
  // Prefetches prerender the page with cookies available, but supabase-js checks the session's
  // expiry with Date.now(), which Next refuses while prerendering ("unstable value `Date.now()`").
  // Supabase reads are per-request anyway, so stop the prerender here; requests go straight on.
  await connection()
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
