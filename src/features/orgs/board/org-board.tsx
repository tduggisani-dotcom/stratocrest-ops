import { todayEt } from "@/lib/dates"
import type { OrgFilters } from "../filters"
import type { OrgKind } from "../kind-config"
import type { OrgListItem } from "../queries/list"
import { boardColumns, toBoardCard, type BoardCard } from "./board-logic"
import { BoardView } from "./board-view"

/**
 * The Kanban (spec §6.2, a secondary view of the tracker): one column per
 * stage, and a card per org. Drag a card (mouse, touch, or keyboard) or use
 * its "Move to" menu to change the stage. `orgs` is the same filtered, sorted
 * list the table shows; a stage filter narrows the columns to those stages.
 * Archived orgs can't change stage, so the archived view is read-only.
 *
 * A server component (the list page renders it inside its Suspense): it works
 * out "today" for the due dates and sends the browser only what cards show.
 */
export function OrgBoard({
  kind,
  orgs,
  filters,
}: {
  kind: OrgKind
  orgs: OrgListItem[]
  filters: OrgFilters
}) {
  const cards = orgs.map(toBoardCard).filter((card): card is BoardCard => card !== null)
  return (
    <BoardView
      kind={kind}
      cards={cards}
      columns={boardColumns(kind, filters)}
      today={todayEt()}
      readOnly={filters.archived}
    />
  )
}
