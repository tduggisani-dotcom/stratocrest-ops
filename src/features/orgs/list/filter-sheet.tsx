"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { SlidersHorizontal, X } from "lucide-react"
import { PersonAvatar } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { serializeOrgFilters, type OrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgListHref } from "../links"
import { filtersFromForm, STALE_FILTER_LABEL, type FilterGroup } from "./filter-options"

const OPTION =
  "flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50"

/**
 * The filters on phones: a "Filters (n)" button that opens a sheet of
 * checkboxes. Nothing changes until "Show results", which applies every pick
 * in one navigation and closes the sheet (each tap navigating would reload
 * the list behind the sheet over and over on a slow connection).
 */
export function FilterSheet({
  kind,
  filters,
  groups,
  activeCount,
  className,
}: {
  kind: OrgKind
  filters: OrgFilters
  groups: FilterGroup[]
  activeCount: number
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const config = kindConfig(kind)

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = filtersFromForm(kind, filters, new FormData(event.currentTarget))
    setOpen(false)
    router.push(orgListHref(kind, serializeOrgFilters(next)), { scroll: false })
  }

  function uncheckAll() {
    for (const input of formRef.current?.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    ) ?? []) {
      input.checked = false
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn("shrink-0", className)}>
          <SlidersHorizontal aria-hidden />
          Filters
          {activeCount > 0 ? (
            <Badge className="tabular-nums">
              {activeCount}
              <span className="sr-only"> on</span>
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 pb-2">
          <div className="min-w-0">
            <SheetTitle>Filter {config.plural.toLowerCase()}</SheetTitle>
            <SheetDescription>Pick any mix, then show the results.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close">
              <X aria-hidden />
            </Button>
          </SheetClose>
        </SheetHeader>
        <form ref={formRef} onSubmit={apply} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {groups.map((group) => (
              <fieldset key={group.param} className="min-w-0">
                <legend className="mb-1 text-sm font-semibold">{group.legend}</legend>
                <div className="grid grid-cols-2 gap-x-2">
                  {group.options.map((option) => (
                    <label key={option.value} className={OPTION}>
                      <input
                        type="checkbox"
                        name={group.param}
                        value={option.value}
                        defaultChecked={option.selected}
                        className="size-5 shrink-0 accent-primary"
                      />
                      {option.person ? <PersonAvatar person={option.person} size="sm" /> : null}
                      <span className="min-w-0 truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset className="min-w-0">
              <legend className="mb-1 text-sm font-semibold">Contact</legend>
              <label className={OPTION}>
                <input
                  type="checkbox"
                  name="stale"
                  defaultChecked={filters.stale}
                  className="size-5 shrink-0 accent-primary"
                />
                <span>{STALE_FILTER_LABEL}</span>
              </label>
            </fieldset>
          </div>
          <SheetFooter className="flex-row gap-2 border-t">
            <Button type="button" variant="ghost" className="flex-1" onClick={uncheckAll}>
              Uncheck all
            </Button>
            <Button type="submit" className="flex-1">
              Show results
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
