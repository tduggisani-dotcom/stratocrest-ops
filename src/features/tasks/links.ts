import type { Route } from "next"
import type { IsoDate } from "@/lib/dates"
import { DEFAULT_NEXT_PATH, safeNextPath } from "@/lib/schemas/auth"
import type { TaskView } from "./views"

/** URLs into and out of the Tasks section, in one place (typedRoutes checks the paths). */

export function taskHref(id: string): Route {
  return `/tasks/${encodeURIComponent(id)}` as Route
}

export function tasksViewHref(view: TaskView): Route {
  return view === "mine" ? "/tasks" : `/tasks?view=${view}`
}

/** What /tasks/new can prefill from its query string. */
export type NewTaskPrefill = {
  owner?: string
  due?: IsoDate
  org?: string
  session?: string
  kr?: string
  teamMeeting?: string
  orgMeeting?: string
  /** Where to go after saving (checked with safeNextPath by the action). */
  returnTo?: string
}

const PREFILL_PARAMS = {
  owner: "owner",
  due: "due",
  org: "org",
  session: "session",
  kr: "kr",
  teamMeeting: "team_meeting",
  orgMeeting: "org_meeting",
  returnTo: "return_to",
} as const satisfies Record<keyof NewTaskPrefill, string>

/** "/tasks/new?owner=…&return_to=%2Ftasks%3Fview%3Downer". Use from any section to add a linked task. */
export function newTaskHref(prefill: NewTaskPrefill = {}): Route {
  const query = new URLSearchParams()
  for (const key of Object.keys(PREFILL_PARAMS) as (keyof NewTaskPrefill)[]) {
    const value = prefill[key]
    if (value) query.set(PREFILL_PARAMS[key], value)
  }
  const search = query.toString()
  return search ? `/tasks/new?${search}` : "/tasks/new"
}

/** Orgs live in two lists that share one implementation (src/features/orgs/links.ts). */
export { orgListHref } from "@/features/orgs/links"

/**
 * Where the new-task form goes after saving (its `return_to`): a same-site path
 * checked with safeNextPath, else /tasks.
 */
export function taskReturnPath(value: unknown): Route {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== "string" || first === "") return "/tasks"
  const path = safeNextPath(first)
  return path === DEFAULT_NEXT_PATH && first !== DEFAULT_NEXT_PATH ? "/tasks" : path
}
