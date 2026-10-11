import { ORG_REGIONS } from "@/lib/labels"
import { isStageOf, type OrgKind, type OrgRegion } from "./kind-config"

/**
 * The tracker's filters, sort and view live in the URL, so a view can be
 * shared or reloaded, and the table, the board and the CSV export all read
 * the same thing. Multi-value filters are comma-separated:
 * `/investors?stage=meeting,diligence&region=ohio&stale=1&sort=rating&dir=desc`.
 * Unknown values are dropped, never an error.
 */

export const ORG_VIEWS = ["table", "board"] as const
export type OrgView = (typeof ORG_VIEWS)[number]

/** Latest rating filter: exact 1–5, or "none" (no rated meeting yet). */
export const RATING_FILTERS = ["5", "4", "3", "2", "1", "none"] as const
export type RatingFilter = (typeof RATING_FILTERS)[number]

export const ORG_SORT_KEYS = [
  "next_step", // next step date (default: what's due first)
  "name",
  "location",
  "first_contact",
  "latest_meeting",
  "next_meeting",
  "owner",
  "rating",
  "stage",
] as const
export type OrgSortKey = (typeof ORG_SORT_KEYS)[number]
export type SortDirection = "asc" | "desc"

export type OrgFilters = {
  view: OrgView
  stages: string[]
  owners: string[]
  regions: OrgRegion[]
  ratings: RatingFilter[]
  /** Only open orgs with no contact for 14+ days. */
  stale: boolean
  /** Name search (case-insensitive substring), trimmed, at most 100 characters. */
  q: string
  /** Show archived orgs instead of active ones. */
  archived: boolean
  sort: OrgSortKey
  dir: SortDirection
}

export const DEFAULT_SORT: { sort: OrgSortKey; dir: SortDirection } = {
  sort: "next_step",
  dir: "asc",
}

export const MAX_QUERY_LENGTH = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParamsInput =
  URLSearchParams | Record<string, string | string[] | undefined> | null | undefined

function read(params: SearchParamsInput, key: string): string | undefined {
  if (!params) return undefined
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

function list(params: SearchParamsInput, key: string): string[] {
  const raw = read(params, key)
  if (!raw) return []
  return [...new Set(raw.split(",").map((part) => part.trim()))].filter(Boolean)
}

function oneOf<T extends string>(values: readonly T[], value: string | undefined, fallback: T): T {
  return value !== undefined && (values as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

function flag(params: SearchParamsInput, key: string): boolean {
  const value = read(params, key)
  return value === "1" || value === "true"
}

/** Reads the tracker state from a page's searchParams (or a URLSearchParams). */
export function parseOrgFilters(kind: OrgKind, params: SearchParamsInput): OrgFilters {
  return {
    view: oneOf(ORG_VIEWS, read(params, "view"), "table"),
    stages: list(params, "stage").filter((stage) => isStageOf(kind, stage)),
    owners: list(params, "owner")
      .filter((id) => UUID.test(id))
      .map((id) => id.toLowerCase()),
    regions: list(params, "region").filter((region): region is OrgRegion =>
      (ORG_REGIONS as readonly string[]).includes(region),
    ),
    ratings: list(params, "rating").filter((rating): rating is RatingFilter =>
      (RATING_FILTERS as readonly string[]).includes(rating),
    ),
    stale: flag(params, "stale"),
    q: (read(params, "q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    archived: flag(params, "archived"),
    sort: oneOf(ORG_SORT_KEYS, read(params, "sort"), DEFAULT_SORT.sort),
    dir: oneOf(["asc", "desc"] as const, read(params, "dir"), DEFAULT_SORT.dir),
  }
}

export const DEFAULT_FILTERS: OrgFilters = {
  view: "table",
  stages: [],
  owners: [],
  regions: [],
  ratings: [],
  stale: false,
  q: "",
  archived: false,
  ...DEFAULT_SORT,
}

/**
 * The query string for `filters` (without "?"), leaving out defaults so URLs
 * stay short. `changes` override fields, e.g. `{ sort: "rating", dir: "desc" }`.
 */
export function serializeOrgFilters(
  filters: OrgFilters,
  changes: Partial<OrgFilters> = {},
): string {
  const next = { ...filters, ...changes }
  const query = new URLSearchParams()
  if (next.view !== "table") query.set("view", next.view)
  if (next.stages.length) query.set("stage", next.stages.join(","))
  if (next.owners.length) query.set("owner", next.owners.join(","))
  if (next.regions.length) query.set("region", next.regions.join(","))
  if (next.ratings.length) query.set("rating", next.ratings.join(","))
  if (next.stale) query.set("stale", "1")
  if (next.q) query.set("q", next.q)
  if (next.archived) query.set("archived", "1")
  if (next.sort !== DEFAULT_SORT.sort || next.dir !== DEFAULT_SORT.dir) {
    query.set("sort", next.sort)
    query.set("dir", next.dir)
  }
  return query.toString()
}

/** True when anything narrows the list (not counting view and sort). */
export function hasActiveFilters(filters: OrgFilters): boolean {
  return (
    filters.stages.length > 0 ||
    filters.owners.length > 0 ||
    filters.regions.length > 0 ||
    filters.ratings.length > 0 ||
    filters.stale ||
    filters.q !== "" ||
    filters.archived
  )
}
