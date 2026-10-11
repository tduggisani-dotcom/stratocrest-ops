import type { Route } from "next"
import { KIND_CONFIG, type OrgKind } from "./kind-config"

/**
 * URLs for investors, customers and hypotheses, in one place (typedRoutes
 * checks the paths). Investors and customers share one implementation, so
 * every helper takes the kind.
 */

function base(kind: OrgKind): string {
  return KIND_CONFIG[kind].basePath
}

function withQuery(path: string, query?: string): Route {
  return (query ? `${path}?${query}` : path) as Route
}

/** The table or board, with an optional query string from serializeOrgFilters. */
export function orgListHref(kind: OrgKind, query?: string): Route {
  return withQuery(base(kind), query)
}

/** CSV of the current filtered view (same query string as the list). */
export function orgExportHref(kind: OrgKind, query?: string): string {
  return query ? `${base(kind)}/export?${query}` : `${base(kind)}/export`
}

export function newOrgHref(kind: OrgKind): Route {
  return `${base(kind)}/new` as Route
}

export function orgHref(kind: OrgKind, id: string): Route {
  return `${base(kind)}/${encodeURIComponent(id)}` as Route
}

export function editOrgHref(kind: OrgKind, id: string): Route {
  return `${base(kind)}/${encodeURIComponent(id)}/edit` as Route
}

/** Screen 1 of logging a meeting. */
export function newMeetingHref(kind: OrgKind, orgId: string): Route {
  return `${base(kind)}/${encodeURIComponent(orgId)}/meetings/new` as Route
}

/**
 * A meeting's page: edit it, write its debrief. `logged` shows screen 2 of the
 * logging flow ("Meeting logged": debrief + one-click follow-up task).
 */
export function meetingHref(
  kind: OrgKind,
  orgId: string,
  meetingId: string,
  options: { logged?: boolean } = {},
): Route {
  const path = `${base(kind)}/${encodeURIComponent(orgId)}/meetings/${encodeURIComponent(meetingId)}`
  return withQuery(path, options.logged ? "logged=1" : undefined)
}

/** The hypothesis roll-up across investors and customers. */
export function hypothesesHref(query?: string): Route {
  return withQuery("/hypotheses", query)
}

export function hypothesisHref(id: string): Route {
  return `/hypotheses/${encodeURIComponent(id)}` as Route
}
