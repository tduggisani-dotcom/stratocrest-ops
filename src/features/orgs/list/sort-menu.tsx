"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ORG_SORT_KEYS, type OrgFilters, type OrgSortKey, type SortDirection } from "../filters"
import type { OrgKind } from "../kind-config"
import { SORT_OPTIONS, sortDirectionHref, sortKeyHref } from "./filter-options"

const ITEM = "max-md:min-h-11"

function isSortKey(value: string): value is OrgSortKey {
  return (ORG_SORT_KEYS as readonly string[]).includes(value)
}

/**
 * "Sort: Next step date": every sort the table headers offer, plus stage
 * (no column of its own), and the direction. The only way to sort the phone
 * cards. A menu, so arrowing through the choices changes nothing until one
 * is picked.
 */
export function SortMenu({ kind, filters }: { kind: OrgKind; filters: OrgFilters }) {
  const router = useRouter()
  const current = SORT_OPTIONS[filters.sort]

  function go(href: Route) {
    router.push(href, { scroll: false })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-0">
          <ArrowUpDown aria-hidden />
          <span className="truncate">
            <span className="max-sm:sr-only">Sort: </span>
            {current.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.sort}
          onValueChange={(value) => {
            if (isSortKey(value)) go(sortKeyHref(kind, filters, value))
          }}
        >
          {ORG_SORT_KEYS.map((key) => (
            <DropdownMenuRadioItem key={key} value={key} className={ITEM}>
              {SORT_OPTIONS[key].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Order</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filters.dir}
          onValueChange={(value) => {
            if (value === "asc" || value === "desc") {
              go(sortDirectionHref(kind, filters, value satisfies SortDirection))
            }
          }}
        >
          <DropdownMenuRadioItem value="asc" className={ITEM}>
            {capitalize(current.asc)}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="desc" className={ITEM}>
            {capitalize(current.desc)}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
