import type { OrgFilters } from "../filters"
import type { OrgKind } from "../kind-config"
import type { OrgListItem } from "../queries/list"

/**
 * CONTRACT (Stage 3 build; the board agent implements it, the list page
 * renders it for `view=board`). The Kanban: one column per stage, drag (mouse,
 * touch, keyboard) or a "Move to" menu to change an org's stage. `orgs` is the
 * same filtered list the table shows.
 */
export function OrgBoard(_props: { kind: OrgKind; orgs: OrgListItem[]; filters: OrgFilters }) {
  return null
}
