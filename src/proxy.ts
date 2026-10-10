import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

/**
 * Runs before every page request (Node runtime): refreshes the Supabase session
 * cookie and sends signed-out visitors to /sign-in. An optimistic check only:
 * pages, Server Actions and Row Level Security verify access themselves.
 */
export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - /api and /api/… (the bot API checks its own bearer keys; no cookies there)
     * - Next.js build files and image optimization (_next/static, _next/image)
     * - favicon.ico, robots.txt, sitemap.xml and other static files, by extension
     */
    "/((?!api(?:/|$)|_next/static|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpe?g|gif|webp|avif|ico|bmp|txt|xml|json|webmanifest|css|js|map|woff2?|ttf|otf)$).*)",
  ],
}
