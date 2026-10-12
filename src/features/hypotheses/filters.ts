import type { OrgKind } from "@/features/orgs/kind-config"
import { ORG_KINDS } from "@/lib/labels"

/**
 * The roll-up's filters live in the URL, so a view can be shared or reloaded:
 * `/hypotheses?audience=customer&owner=<person id>`. `owner=none` means
 * nobody owns it yet; `archived=1` shows archived hypotheses instead;
 * `add=1` opens the add form. Unknown values are dropped, never an error.
 */

export type HypothesisFilters = {
  audience: OrgKind | null
  /** A person's id, or "none" for hypotheses without an owner. */
  owner: string | null
  archived: boolean
  /** Open the "Add hypothesis" form. */
  add: boolean
}

export const DEFAULT_HYPOTHESIS_FILTERS: HypothesisFilters = {
  audience: null,
  owner: null,
  archived: false,
  add: false,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParamsInput =
  URLSearchParams | Record<string, string | string[] | undefined> | null | undefined

function read(params: SearchParamsInput, key: string): string | undefined {
  if (!params) return undefined
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim()
}

function flag(params: SearchParamsInput, key: string): boolean {
  const value = read(params, key)
  return value === "1" || value === "true"
}

/** Reads the roll-up's state from a page's searchParams (or a URLSearchParams). */
export function parseHypothesisFilters(params: SearchParamsInput): HypothesisFilters {
  const audience = read(params, "audience")
  const owner = read(params, "owner")
  return {
    audience: ORG_KINDS.find((kind) => kind === audience) ?? null,
    owner: owner === "none" ? "none" : owner && UUID.test(owner) ? owner.toLowerCase() : null,
    archived: flag(params, "archived"),
    add: flag(params, "add"),
  }
}

/**
 * The query string for `filters` (without "?"), leaving out defaults. `changes`
 * override fields. Links between views drop `add` unless they set it.
 */
export function serializeHypothesisFilters(
  filters: HypothesisFilters,
  changes: Partial<HypothesisFilters> = {},
): string {
  const next = { ...filters, add: false, ...changes }
  const query = new URLSearchParams()
  if (next.audience) query.set("audience", next.audience)
  if (next.owner) query.set("owner", next.owner)
  if (next.archived) query.set("archived", "1")
  if (next.add) query.set("add", "1")
  return query.toString()
}

/** True when anything narrows the roll-up (not counting the add form). */
export function hasActiveHypothesisFilters(filters: HypothesisFilters): boolean {
  return filters.audience !== null || filters.owner !== null || filters.archived
}
