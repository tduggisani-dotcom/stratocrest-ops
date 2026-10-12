import Link from "next/link"
import { Columns3, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ORG_VIEWS, type OrgFilters, type OrgView } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { viewHref } from "./filter-options"

const VIEW_LABELS: Record<OrgView, string> = { table: "Table", board: "Board" }
const VIEW_ICONS = { table: Table2, board: Columns3 } satisfies Record<OrgView, unknown>

/** Table | Board, as links that keep the filters (each view has its own URL). */
export function ViewSwitcher({ kind, filters }: { kind: OrgKind; filters: OrgFilters }) {
  return (
    <nav aria-label={`${kindConfig(kind).singular} views`}>
      <ul className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {ORG_VIEWS.map((view) => {
          const active = filters.view === view
          const Icon = VIEW_ICONS[view]
          return (
            <li key={view}>
              <Link
                href={viewHref(kind, filters, view)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none md:h-8",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {VIEW_LABELS[view]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
