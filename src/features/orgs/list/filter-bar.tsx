import Link from "next/link"
import { Check, X } from "lucide-react"
import { PersonAvatar } from "@/components/common/person-chip"
import { cn } from "@/lib/utils"
import { hasActiveFilters, type OrgFilters } from "../filters"
import type { OrgKind } from "../kind-config"
import {
  activeFilterCount,
  clearFiltersHref,
  filterGroups,
  STALE_FILTER_LABEL,
  staleToggleHref,
  type FilterOption,
  type FilterOwner,
} from "./filter-options"
import { FilterSheet } from "./filter-sheet"
import { SearchForm } from "./search-form"

// Label above the chips on narrow desktops, beside them from lg.
const GROUP = "flex flex-col gap-1.5 lg:flex-row lg:items-start lg:gap-3"
const GROUP_LABEL = "shrink-0 text-xs font-medium text-muted-foreground lg:w-44 lg:pt-1.5"

/**
 * Stage, point of contact, region, rating, stale and a name search, all in
 * the URL. On desktop every choice is an inline chip: a link that toggles it
 * (works from the keyboard, keeps the sort and the view). On phones the
 * choices sit in a "Filters (n)" sheet. "Clear filters" shows when anything
 * narrows the list.
 */
export function FilterBar({
  kind,
  filters,
  owners,
}: {
  kind: OrgKind
  filters: OrgFilters
  owners: readonly FilterOwner[]
}) {
  const groups = filterGroups(kind, filters, owners)
  const active = hasActiveFilters(filters)
  // Ids carry the kind: Next keeps a visited /customers alive (hidden) next to /investors.
  const id = (part: string) => `org-${kind}-${part}`
  return (
    <section aria-labelledby={id("filters")} className="space-y-3">
      <h2 id={id("filters")} className="sr-only">
        Filters
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <SearchForm kind={kind} filters={filters} className="min-w-0 flex-1 md:max-w-sm" />
        <FilterSheet
          kind={kind}
          filters={filters}
          groups={groups}
          activeCount={activeFilterCount(filters)}
          className="md:hidden"
        />
        {active ? <ClearFiltersLink href={clearFiltersHref(kind, filters)} /> : null}
      </div>

      <div className="hidden space-y-2 rounded-xl border bg-card p-3 md:block">
        {groups.map((group) => {
          const labelId = id(`filter-${group.param}`)
          return (
            <div key={group.param} role="group" aria-labelledby={labelId} className={GROUP}>
              <span id={labelId} className={GROUP_LABEL}>
                {group.legend}
              </span>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {group.options.map((option) => (
                  <li key={option.value}>
                    <FilterChip option={option} />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        <div role="group" aria-labelledby={id("filter-stale")} className={GROUP}>
          <span id={id("filter-stale")} className={GROUP_LABEL}>
            Contact
          </span>
          <FilterChip
            option={{
              value: "stale",
              label: STALE_FILTER_LABEL,
              selected: filters.stale,
              href: staleToggleHref(kind, filters),
            }}
          />
        </div>
      </div>
    </section>
  )
}

/** One choice: a link that turns it on or off. Selected chips use the accent colour and a tick. */
function FilterChip({ option }: { option: FilterOption }) {
  return (
    <Link
      href={option.href}
      scroll={false}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        option.selected
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        option.person && "pl-1",
      )}
    >
      {option.selected ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
      {option.person ? (
        <PersonAvatar person={option.person} size="sm" className="size-6 shrink-0" />
      ) : null}
      <span className="truncate">{option.label}</span>
      {option.selected ? <span className="sr-only"> (on)</span> : null}
    </Link>
  )
}

function ClearFiltersLink({ href }: { href: FilterOption["href"] }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
    >
      <X aria-hidden className="size-4" />
      Clear filters
    </Link>
  )
}
