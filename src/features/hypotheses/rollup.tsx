import { Suspense, type ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"
import { Archive, ArrowLeft, Check, FlaskConical, Plus, X, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { LiveRefresh } from "@/components/common/live-refresh"
import { PersonAvatar, firstNameOf } from "@/components/common/person-chip"
import { PageHeader } from "@/components/shell/page-header"
import { hypothesesHref } from "@/features/orgs/links"
import { ORG_LIVE_TABLES } from "@/features/orgs/types"
import { CountBadge } from "@/features/this-week/components/section-card"
import { requireTeamMember } from "@/lib/auth"
import { getActivePeople, type TeamMember } from "@/lib/data/people"
import { ORG_KINDS, hypothesisStatusLabels, orgKindLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { STATUS_ICONS } from "./badges"
import { DisclosurePanel, DisclosureScope, DisclosureToggle } from "./disclosure"
import {
  hasActiveHypothesisFilters,
  parseHypothesisFilters,
  serializeHypothesisFilters,
  type HypothesisFilters,
} from "./filters"
import { HypothesisForm } from "./hypothesis-form"
import { HypothesisItem } from "./hypothesis-item"
import { countArchivedHypotheses, getOrgOptions, listHypotheses } from "./queries"
import { RollupSkeleton } from "./skeletons"
import { groupByStatus } from "./summary"
import type { HypothesisListItem, HypothesisStatus } from "./types"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PAGE_DESCRIPTION =
  "What we believe about investors and customers, how we're testing it, and what we learned."

/**
 * The hypothesis roll-up across investors and customers (spec §6.3):
 * Untested / Validated / Invalidated, side by side on wide screens and
 * stacked on phones, filtered by audience and owner (in the URL), with an
 * inline "Add hypothesis" form (/hypotheses?add=1 opens it). The header is
 * the static shell; the rest streams in and refreshes live.
 */
export function HypothesesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <PageHeader title="Hypotheses" description={PAGE_DESCRIPTION} />
      <Suspense fallback={<RollupSkeleton />}>
        <HypothesesRollup searchParams={searchParams} />
      </Suspense>
    </>
  )
}

const SECTION_EMPTY: Record<HypothesisStatus, { title: string; description: string }> = {
  untested: {
    title: "Nothing waiting to be tested",
    description:
      "New hypotheses start here. Write down what we believe before the next conversation.",
  },
  validated: {
    title: "Nothing validated yet",
    description: "When the evidence supports a hypothesis, mark it Validated on its page.",
  },
  invalidated: {
    title: "Nothing invalidated yet",
    description:
      "When the evidence contradicts a hypothesis, mark it Invalidated on its page. That's learning too.",
  },
}

async function HypothesesRollup({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireTeamMember()
  const filters = parseHypothesisFilters(await searchParams)
  const [items, people, orgs, archivedCount] = await Promise.all([
    listHypotheses(filters),
    getActivePeople(),
    getOrgOptions(),
    countArchivedHypotheses(),
  ])
  const canAdd = !filters.archived
  const groups = groupByStatus(items)

  return (
    <DisclosureScope defaultOpen={filters.add && canAdd}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <RollupFilters filters={filters} people={people} />
          {canAdd ? (
            <DisclosureToggle className="max-md:w-full lg:shrink-0">
              <Plus aria-hidden />
              Add hypothesis
            </DisclosureToggle>
          ) : null}
        </div>

        {canAdd ? (
          <DisclosurePanel label="Add a hypothesis">
            <HypothesisForm
              mode="create"
              orgs={orgs}
              people={people.map(({ id, name }) => ({ id, name }))}
              defaults={{ owner_id: me.id, about: filters.audience ?? "" }}
            />
          </DisclosurePanel>
        ) : null}

        {items.length === 0 ? (
          <RollupEmpty filters={filters} canAdd={canAdd} />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-3">
            {groups.map((group) => (
              <StatusSection
                key={group.status}
                status={group.status}
                items={group.items}
                canAdd={canAdd}
              />
            ))}
          </div>
        )}

        <ArchivedToggle filters={filters} archivedCount={archivedCount} />
      </div>
    </DisclosureScope>
  )
}

/** One status: its name and count, then its hypotheses (or a quiet empty state). */
function StatusSection({
  status,
  items,
  canAdd,
}: {
  status: HypothesisStatus
  items: HypothesisListItem[]
  canAdd: boolean
}) {
  const Icon = STATUS_ICONS[status]
  const headingId = `hypotheses-${status}`
  const empty = SECTION_EMPTY[status]
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-muted/40 p-3"
    >
      <header className="flex min-h-8 items-center gap-2 px-1">
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            status === "validated" ? "text-good" : "text-muted-foreground",
          )}
        />
        <h2 id={headingId} className="text-base font-semibold">
          {hypothesisStatusLabels[status]}
        </h2>
        <CountBadge count={items.length} label={items.length === 1 ? "hypothesis" : "hypotheses"} />
      </header>
      {items.length > 0 ? (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {items.map((item) => (
            <HypothesisItem key={item.id} item={item} showAbout showStatus={false} />
          ))}
        </ul>
      ) : (
        <EmptyState
          titleAs="h3"
          size="compact"
          title={empty.title}
          description={empty.description}
          className="bg-card"
          action={
            canAdd ? (
              <DisclosureToggle variant="outline" className="max-md:w-full">
                <Plus aria-hidden />
                Add hypothesis
              </DisclosureToggle>
            ) : null
          }
        />
      )}
    </section>
  )
}

/** Nothing at all, nothing matching the filters, or nothing archived. */
function RollupEmpty({ filters, canAdd }: { filters: HypothesisFilters; canAdd: boolean }) {
  if (filters.archived) {
    return (
      <EmptyState
        icon={Archive}
        title={
          hasActiveHypothesisFilters({ ...filters, archived: false })
            ? "No archived hypotheses match these filters"
            : "Nothing archived"
        }
        description="Archived hypotheses show here. Archive one from its page; restore it the same way."
        action={
          <TextLink href={hypothesesHref()} icon={ArrowLeft}>
            Back to active hypotheses
          </TextLink>
        }
      />
    )
  }
  if (hasActiveHypothesisFilters(filters)) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No hypotheses match these filters"
        description="Try another audience or owner, or add one."
        action={
          <>
            {canAdd ? (
              <DisclosureToggle className="max-md:w-full">
                <Plus aria-hidden />
                Add hypothesis
              </DisclosureToggle>
            ) : null}
            <TextLink href={hypothesesHref()}>Clear filters</TextLink>
          </>
        }
      />
    )
  }
  return (
    <EmptyState
      icon={FlaskConical}
      title="No hypotheses yet"
      description="Every investor and customer conversation tests something we believe. Write it down, test it, and record what we learned: it shows here as untested, validated or invalidated."
      action={
        <DisclosureToggle className="max-md:w-full">
          <Plus aria-hidden />
          Add your first hypothesis
        </DisclosureToggle>
      }
    />
  )
}

type FilterLink = {
  key: string
  label: string
  selected: boolean
  href: Route
  person?: Pick<TeamMember, "name" | "avatarUrl">
}

/** Audience and owner, as links (in the URL, so a view can be shared and reloaded). */
function RollupFilters({
  filters,
  people,
}: {
  filters: HypothesisFilters
  people: readonly TeamMember[]
}) {
  const href = (changes: Partial<HypothesisFilters>) =>
    hypothesesHref(serializeHypothesisFilters(filters, changes))
  const audience: FilterLink[] = [
    {
      key: "all",
      label: "All",
      selected: filters.audience === null,
      href: href({ audience: null }),
    },
    ...ORG_KINDS.map((kind) => ({
      key: kind,
      label: orgKindLabels[kind].plural,
      selected: filters.audience === kind,
      href: href({ audience: kind }),
    })),
  ]
  const owners: FilterLink[] = [
    { key: "any", label: "Anyone", selected: filters.owner === null, href: href({ owner: null }) },
    ...people.map((person) => ({
      key: person.id,
      label: firstNameOf(person.name),
      selected: filters.owner === person.id,
      href: href({ owner: person.id }),
      person,
    })),
    {
      key: "none",
      label: "Nobody yet",
      selected: filters.owner === "none",
      href: href({ owner: "none" }),
    },
  ]
  return (
    <section aria-labelledby="hypotheses-filters" className="min-w-0 space-y-3">
      <h2 id="hypotheses-filters" className="sr-only">
        Filters
      </h2>
      <FilterGroup id="hypotheses-filter-audience" legend="About" links={audience} />
      <FilterGroup id="hypotheses-filter-owner" legend="Owner" links={owners} />
      {filters.audience || filters.owner ? (
        <TextLink href={href({ audience: null, owner: null })}>Clear filters</TextLink>
      ) : null}
    </section>
  )
}

function FilterGroup({ id, legend, links }: { id: string; legend: string; links: FilterLink[] }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5 md:flex-row md:gap-3">
      <span id={id} className="shrink-0 text-xs font-medium text-muted-foreground md:w-14 md:pt-2">
        {legend}
      </span>
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              scroll={false}
              aria-current={link.selected ? "true" : undefined}
              className={cn(
                "inline-flex h-11 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors outline-none md:h-8 md:text-xs",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                link.selected
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                link.person && "pl-1",
              )}
            >
              {link.selected ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
              {link.person ? (
                <PersonAvatar person={link.person} size="sm" className="size-6 shrink-0" />
              ) : null}
              <span className="truncate">{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "Show archived (2)" under the roll-up, or the way back. */
function ArchivedToggle({
  filters,
  archivedCount,
}: {
  filters: HypothesisFilters
  archivedCount: number
}) {
  if (!filters.archived && archivedCount === 0) return null
  return (
    <div className="flex justify-center">
      <Link
        href={hypothesesHref(serializeHypothesisFilters(filters, { archived: !filters.archived }))}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
      >
        <Archive aria-hidden className="size-4" />
        {filters.archived ? "Back to active hypotheses" : `Show archived (${archivedCount})`}
      </Link>
    </div>
  )
}

/** A text link with a 44 px tap target on phones ("Clear filters"). */
function TextLink({
  href,
  icon: Icon = X,
  children,
}: {
  href: Route
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9"
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </Link>
  )
}
