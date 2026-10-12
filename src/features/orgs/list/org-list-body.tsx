import Link from "next/link"
import { Archive } from "lucide-react"
import { requireTeamMember } from "@/lib/auth"
import { getActivePeople } from "@/lib/data/people"
import { todayEt, type IsoDate } from "@/lib/dates"
import { OrgBoard } from "../board/org-board"
import { hasActiveFilters, parseOrgFilters, type OrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { countArchivedOrgs, listOrgs, summarizeOrgs, type OrgListItem } from "../queries/list"
import { NoArchived, NoMatches, NoOrgs } from "./empty-states"
import { FilterBar } from "./filter-bar"
import { archivedToggleHref } from "./filter-options"
import { OrgCards } from "./org-cards"
import { OrgTable } from "./org-table"
import { SortMenu } from "./sort-menu"
import { SummaryBar } from "./summary-bar"
import { ViewSwitcher } from "./view-switcher"

export type OrgSearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Everything below the page header: view switcher, summary, filters, then the
 * table and cards (or the board). Reads the session, the URL and the
 * database, so the page renders it inside <Suspense>.
 */
export async function OrgListBody({
  kind,
  searchParams,
}: {
  kind: OrgKind
  searchParams: OrgSearchParams
}) {
  await requireTeamMember()
  const today = todayEt()
  const filters = parseOrgFilters(kind, await searchParams)
  const [orgs, people, archivedCount] = await Promise.all([
    listOrgs(kind, filters),
    getActivePeople(),
    countArchivedOrgs(kind),
  ])

  if (orgs.length === 0 && !hasActiveFilters(filters)) {
    return (
      <div className="space-y-4">
        <NoOrgs kind={kind} />
        <ArchivedToggle kind={kind} filters={filters} archivedCount={archivedCount} />
      </div>
    )
  }

  const summary = await summarizeOrgs(kind, orgs)
  const config = kindConfig(kind)
  const owners = people.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewSwitcher kind={kind} filters={filters} />
        {filters.view === "table" && orgs.length > 1 ? (
          <SortMenu kind={kind} filters={filters} />
        ) : null}
      </div>

      {filters.archived ? (
        <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-pretty text-muted-foreground">
          Showing archived {config.plural.toLowerCase()}, kept with their meetings and notes.
        </p>
      ) : null}

      {orgs.length > 0 ? (
        <SummaryBar
          kind={kind}
          summary={summary}
          overdueFollowUps={orgs.filter((org) => org.follow_up_overdue).length}
        />
      ) : null}

      <FilterBar kind={kind} filters={filters} owners={owners} />

      <section aria-labelledby={`org-${kind}-results`} className="space-y-3">
        <h2 id={`org-${kind}-results`} className="sr-only">
          {orgs.length} {orgs.length === 1 ? config.singular : config.plural}
        </h2>
        <Results kind={kind} orgs={orgs} filters={filters} today={today} />
      </section>

      <ArchivedToggle kind={kind} filters={filters} archivedCount={archivedCount} />
    </div>
  )
}

function Results({
  kind,
  orgs,
  filters,
  today,
}: {
  kind: OrgKind
  orgs: OrgListItem[]
  filters: OrgFilters
  today: IsoDate
}) {
  if (orgs.length === 0) {
    const onlyArchived = !hasActiveFilters({ ...filters, archived: false })
    return filters.archived && onlyArchived ? (
      <NoArchived kind={kind} filters={filters} />
    ) : (
      <NoMatches kind={kind} filters={filters} />
    )
  }
  if (filters.view === "board") return <OrgBoard kind={kind} orgs={orgs} filters={filters} />
  return (
    <>
      <OrgTable kind={kind} orgs={orgs} filters={filters} today={today} />
      <OrgCards kind={kind} orgs={orgs} today={today} />
    </>
  )
}

/** The quiet link under the list: "Show archived (n)", or back to the active list. */
function ArchivedToggle({
  kind,
  filters,
  archivedCount,
}: {
  kind: OrgKind
  filters: OrgFilters
  archivedCount: number
}) {
  if (!filters.archived && archivedCount === 0) return null
  const plural = kindConfig(kind).plural.toLowerCase()
  return (
    <p>
      <Link
        href={archivedToggleHref(kind, filters)}
        scroll={false}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
      >
        <Archive aria-hidden className="size-4" />
        {filters.archived ? `Back to active ${plural}` : `Show archived (${archivedCount})`}
      </Link>
    </p>
  )
}
