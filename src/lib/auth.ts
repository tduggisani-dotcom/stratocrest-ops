import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type CurrentPerson = {
  id: string
  name: string
  role: string
  email: string
  avatarUrl: string | null
}

/** The login (auth user id) behind this request, or null. Cached per request. */
const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ?? null
})

/**
 * The signed-in, active teammate for this request, or null.
 * De-duplicated per request with React `cache()`. Reads cookies, so call it
 * inside a <Suspense> boundary, a Server Action, or a Route Handler.
 */
export const getCurrentPerson = cache(async (): Promise<CurrentPerson | null> => {
  const userId = await getSessionUserId()
  if (!userId) return null

  const supabase = await createClient()
  const { data: person } = await supabase
    .from("people")
    .select("id, name, role, email, avatar_url, is_active")
    .eq("auth_user_id", userId)
    .maybeSingle()

  // RLS hides every row from inactive or unknown logins, so `person` is null for them.
  if (!person || !person.is_active) return null

  return {
    id: person.id,
    name: person.name,
    role: person.role,
    email: person.email,
    avatarUrl: person.avatar_url,
  }
})

/**
 * Use at the top of every signed-in page section, Server Action and Route
 * Handler that acts for a person. Redirects to /sign-in when there is no
 * active teammate behind the request: "not-on-team" when someone is signed in
 * but deactivated (or has no profile), "signed-out" otherwise.
 */
export async function requireTeamMember(): Promise<CurrentPerson> {
  const person = await getCurrentPerson()
  if (!person) {
    redirect(
      (await getSessionUserId()) ? "/sign-in?reason=not-on-team" : "/sign-in?reason=signed-out",
    )
  }
  return person
}
