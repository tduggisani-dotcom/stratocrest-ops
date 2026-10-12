import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export type TeamMember = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
  sortOrder: number
}

/**
 * Active teammates in team order (owner pickers, This Week, workload).
 * Cached per request. Reads cookies, so call it inside <Suspense>.
 */
export const getActivePeople = cache(async (): Promise<TeamMember[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("people")
    .select("id, name, role, avatar_url, sort_order")
    .eq("is_active", true)
    .order("sort_order")
  if (error) throw new Error(`Couldn't load the team: ${error.message}`)
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    avatarUrl: p.avatar_url,
    sortOrder: p.sort_order,
  }))
})
