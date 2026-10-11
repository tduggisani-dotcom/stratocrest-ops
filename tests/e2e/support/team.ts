import { admin } from "./admin"

/** A seeded teammate (`pnpm seed`), read from the database so the tests follow TEAM_EMAILS. */
export type Teammate = { id: string; name: string; email: string; firstName: string }

/**
 * Who each flow signs in as. The saved session (global setup) and the sign-out flow use their
 * own people, so signing out never ends a session other tests rely on. Tests run one at a time
 * (one worker) and clear an address's emails before using it, so no test reads another's code.
 * Indexes follow the team order (`sort_order`): John, Taeyoon, Brad, Sam, Ian, Tanush.
 * `live` is the second browser in the live-update test (desktop only); it never signs out.
 */
const CAST = {
  desktop: { session: 0, code: 1, link: 2, signOut: 3, live: 3 },
  mobile: { session: 4, code: 3, link: 2, signOut: 1, live: 1 },
} as const

type Role = keyof (typeof CAST)["desktop"]

/** Last in the facilitator rotation, so briefly deactivating them can't change a meeting. */
const INACTIVE_INDEX = 5

let team: Promise<Teammate[]> | undefined

/** All six teammates, in team order. Fails clearly if the database isn't seeded. */
export function getTeam(): Promise<Teammate[]> {
  team ??= (async () => {
    const { data, error } = await admin
      .from("people")
      .select("id, name, email, is_active")
      .order("sort_order")
    if (error) throw new Error(`Reading people failed: ${error.message}`)
    const active = data.filter((p) => p.is_active)
    if (active.length < 6) {
      throw new Error(
        `Expected 6 active teammates, found ${active.length} (${data.map((p) => `${p.name}${p.is_active ? "" : " (inactive)"}`).join(", ")}). Run pnpm seed, and reactivate anyone a failed run left inactive.`,
      )
    }
    return active.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      firstName: p.name.trim().split(/\s+/)[0] ?? p.name,
    }))
  })()
  return team
}

/** The teammate a flow signs in as in this project ("desktop" or "mobile"). */
export async function teammateFor(project: string, role: Role): Promise<Teammate> {
  if (project !== "desktop" && project !== "mobile") throw new Error(`Unknown project ${project}`)
  const people = await getTeam()
  return people[CAST[project][role]]
}

/** The teammate the inactive-login test switches off for a moment. */
export async function inactiveCandidate(): Promise<Teammate> {
  return (await getTeam())[INACTIVE_INDEX]
}

/** Turn a teammate's access off or on, as an admin would in People. */
export async function setActive(personId: string, isActive: boolean): Promise<void> {
  const { error } = await admin.from("people").update({ is_active: isActive }).eq("id", personId)
  if (error) throw new Error(`Updating people.is_active failed: ${error.message}`)
}
