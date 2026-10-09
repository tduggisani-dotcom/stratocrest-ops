import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/** Paths that work without signing in. Everything else redirects to /sign-in. */
const PUBLIC_PATHS = ["/sign-in", "/auth/"]

export function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p))
}

/**
 * Runs in src/proxy.ts on every page request: refreshes the Supabase session
 * cookie and sends signed-out visitors to /sign-in (an optimistic check; pages
 * and Row Level Security still verify access themselves).
 */
export async function updateSession(request: NextRequest) {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
      },
    },
  })

  // Do not run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.search = ""
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
    const redirect = NextResponse.redirect(url)
    // Keep any cookie changes (e.g. a cleared session).
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  return response
}
