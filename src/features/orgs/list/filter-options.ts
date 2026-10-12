import type { Route } from "next"
import { ORG_REGIONS, orgRegionLabels } from "@/lib/labels"
import {
  DEFAULT_FILTERS,
  parseOrgFilters,
  RATING_FILTERS,
  serializeOrgFilters,
  type OrgFilters,
  type OrgSortKey,
  type RatingFilter,
  type SortDirection,
} from "../filters"
import { kindConfig, OWNER_LABEL, type OrgKind } from "../kind-config"
import { orgListHref } from "../links"

/**
 * The tracker's filter and sort controls as data: which options exist, which
 * are on, and the URL each one leads to. The desktop chips are plain links to
 * these URLs; the phone sheet submits the same choices as a form. Pure.
 */

export type FilterOwner = { id: string; name: string; avatarUrl: string | null }

export type FilterParam = "stage" | "owner" | "region" | "rating"

export type FilterOption = {
  value: string
  label: string
  selected: boolean
  /** The list with this option toggled (other filters, the view and the sort kept). */
  href: Route
  /** Set for the owner filter: the chip shows their avatar. */
  person?: FilterOwner
}

export type FilterGroup = { param: FilterParam; legend: string; options: FilterOption[] }

/** `list` with `value` added, or removed when it's already there. */
export function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function href(kind: OrgKind, filters: OrgFilters, changes: Partial<OrgFilters>): Route {
  return orgListHref(kind, serializeOrgFilters(filters, changes))
}

/** Same "4/5" format as the rating badges in the table. */
export const ratingFilterLabels: Record<RatingFilter, string> = {
  "5": "5/5",
  "4": "4/5",
  "3": "3/5",
  "2": "2/5",
  "1": "1/5",
  none: "Not rated",
}

/**
 * Stage, point of contact, region and rating, in that order. Owners are the
 * active team, plus anyone a filter already names (e.g. a former teammate).
 */
export function filterGroups(
  kind: OrgKind,
  filters: OrgFilters,
  owners: readonly FilterOwner[],
): FilterGroup[] {
  const known = new Set(owners.map((owner) => owner.id))
  const extraOwners = filters.owners
    .filter((id) => !known.has(id))
    .map((id): FilterOwner => ({ id, name: "Former teammate", avatarUrl: null }))

  return [
    {
      param: "stage",
      legend: "Stage",
      options: kindConfig(kind).stages.map((stage) => ({
        value: stage.value,
        label: stage.label,
        selected: filters.stages.includes(stage.value),
        href: href(kind, filters, { stages: toggled(filters.stages, stage.value) }),
      })),
    },
    {
      param: "owner",
      legend: OWNER_LABEL,
      options: [...owners, ...extraOwners].map((owner) => ({
        value: owner.id,
        label: owner.name,
        selected: filters.owners.includes(owner.id),
        href: href(kind, filters, { owners: toggled(filters.owners, owner.id) }),
        person: owner,
      })),
    },
    {
      param: "region",
      legend: "Region",
      options: ORG_REGIONS.map((region) => ({
        value: region,
        label: orgRegionLabels[region],
        selected: filters.regions.includes(region),
        href: href(kind, filters, { regions: toggled(filters.regions, region) }),
      })),
    },
    {
      param: "rating",
      legend: "Latest rating",
      options: RATING_FILTERS.map((rating) => ({
        value: rating,
        label: ratingFilterLabels[rating],
        selected: filters.ratings.includes(rating),
        href: href(kind, filters, { ratings: toggled(filters.ratings, rating) }),
      })),
    },
  ]
}

export const STALE_FILTER_LABEL = "No contact in 14+ days"

export function staleToggleHref(kind: OrgKind, filters: OrgFilters): Route {
  return href(kind, filters, { stale: !filters.stale })
}

/** How many filter choices are on (the "Filters (n)" button); search and archived aside. */
export function activeFilterCount(filters: OrgFilters): number {
  return (
    filters.stages.length +
    filters.owners.length +
    filters.regions.length +
    filters.ratings.length +
    (filters.stale ? 1 : 0)
  )
}

/** Every filter off (search and archived included); the view and the sort stay. */
export function clearFiltersHref(kind: OrgKind, filters: OrgFilters): Route {
  return orgListHref(
    kind,
    serializeOrgFilters(DEFAULT_FILTERS, {
      view: filters.view,
      sort: filters.sort,
      dir: filters.dir,
    }),
  )
}

/** The archived list, or back to the active one; filters reset, view and sort stay. */
export function archivedToggleHref(kind: OrgKind, filters: OrgFilters): Route {
  return orgListHref(
    kind,
    serializeOrgFilters(DEFAULT_FILTERS, {
      view: filters.view,
      sort: filters.sort,
      dir: filters.dir,
      archived: !filters.archived,
    }),
  )
}

/** The current view with a different view (table or board). */
export function viewHref(kind: OrgKind, filters: OrgFilters, view: OrgFilters["view"]): Route {
  return href(kind, filters, { view })
}

/**
 * The hidden fields that ride along with the search box, so a search keeps
 * the other filters, the view and the sort. Values are already in the URL
 * format (comma-separated), so this works as a plain GET form.
 */
export function searchHiddenFields(filters: OrgFilters): [name: string, value: string][] {
  return [...new URLSearchParams(serializeOrgFilters(filters, { q: "" })).entries()]
}

/** Something a form's data can be read from (FormData in the browser, URLSearchParams in tests). */
type FormValues = Pick<FormData, "getAll" | "has">

/**
 * The filters the phone sheet's form asks for: its checkboxes replace the
 * four facets and "stale"; search, archived, view and sort are kept. Unknown
 * values are dropped by the same parser the page uses.
 */
export function filtersFromForm(kind: OrgKind, current: OrgFilters, form: FormValues): OrgFilters {
  const params = new URLSearchParams(serializeOrgFilters(current))
  for (const param of ["stage", "owner", "region", "rating"] as const) {
    const values = form.getAll(param).filter((value): value is string => typeof value === "string")
    if (values.length > 0) params.set(param, values.join(","))
    else params.delete(param)
  }
  if (form.has("stale")) params.set("stale", "1")
  else params.delete("stale")
  return parseOrgFilters(kind, params)
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortOption = {
  label: string
  asc: string
  desc: string
  /** The direction a first click picks (most useful end first). */
  first: SortDirection
}

export const SORT_OPTIONS: Record<OrgSortKey, SortOption> = {
  next_step: { label: "Next step date", asc: "soonest first", desc: "latest first", first: "asc" },
  name: { label: "Company", asc: "A to Z", desc: "Z to A", first: "asc" },
  location: { label: "Location", asc: "A to Z", desc: "Z to A", first: "asc" },
  first_contact: {
    label: "First contact",
    asc: "oldest first",
    desc: "newest first",
    first: "desc",
  },
  latest_meeting: {
    label: "Latest meeting",
    asc: "oldest first",
    desc: "most recent first",
    first: "desc",
  },
  next_meeting: { label: "Next meeting", asc: "soonest first", desc: "latest first", first: "asc" },
  owner: { label: OWNER_LABEL, asc: "A to Z", desc: "Z to A", first: "asc" },
  rating: { label: "Latest rating", asc: "lowest first", desc: "highest first", first: "desc" },
  stage: { label: "Stage", asc: "earliest first", desc: "furthest first", first: "asc" },
}

/** "Next step date, soonest first" */
export function sortDescription(sort: OrgSortKey, dir: SortDirection): string {
  const option = SORT_OPTIONS[sort]
  return `${option.label}, ${dir === "asc" ? option.asc : option.desc}`
}

/** A column header's link: flips the direction when it's the current sort, else its first direction. */
export function sortHref(kind: OrgKind, filters: OrgFilters, sort: OrgSortKey): Route {
  const dir: SortDirection =
    filters.sort === sort ? (filters.dir === "asc" ? "desc" : "asc") : SORT_OPTIONS[sort].first
  return href(kind, filters, { sort, dir })
}

/** The sort menu's "Sort by" choice: that key, in its most useful direction. */
export function sortKeyHref(kind: OrgKind, filters: OrgFilters, sort: OrgSortKey): Route {
  return href(kind, filters, { sort, dir: SORT_OPTIONS[sort].first })
}

/** The sort menu's direction choice for the current key. */
export function sortDirectionHref(kind: OrgKind, filters: OrgFilters, dir: SortDirection): Route {
  return href(kind, filters, { sort: filters.sort, dir })
}

/** aria-sort for a header that sorts by any of `keys`; undefined when it isn't the current sort. */
export function ariaSort(
  filters: OrgFilters,
  keys: readonly OrgSortKey[],
): "ascending" | "descending" | undefined {
  if (!keys.includes(filters.sort)) return undefined
  return filters.dir === "asc" ? "ascending" : "descending"
}
