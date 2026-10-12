import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { OrgFilters, OrgSortKey } from "../filters"
import { kindConfig, OWNER_LABEL, type OrgKind } from "../kind-config"
import { orgHref } from "../links"
import type { OrgListItem } from "../queries/list"
import { HowItWent, MeetingDatesText, Missing, NextStep } from "./cells"
import { companyMeta, firstContact, locationText, regionText } from "./display"
import { ariaSort, sortDescription, sortHref } from "./filter-options"

/**
 * The tracker table (md and up), with the spec's columns up front (§6.2).
 * Rows aren't clickable as a whole: the company name is the link, so the
 * keyboard order stays one stop per row. Headers are links that sort; on
 * narrower desktops the table scrolls inside its own box, never the page.
 */
export function OrgTable({
  kind,
  orgs,
  filters,
  today,
}: {
  kind: OrgKind
  orgs: readonly OrgListItem[]
  filters: OrgFilters
  today: IsoDate
}) {
  const config = kindConfig(kind)
  const header = { kind, filters }
  return (
    <div className="relative hidden overflow-x-auto rounded-xl border bg-card md:block">
      <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
        <caption className="sr-only">
          {config.plural}, sorted by {sortDescription(filters.sort, filters.dir).toLowerCase()}
        </caption>
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <SortHeader {...header} sort="name" className="w-[15%]">
              Company
            </SortHeader>
            <SortHeader {...header} sort="location" className="w-[12%]">
              Location
            </SortHeader>
            <SortHeader {...header} sort="first_contact" className="w-[10%]">
              First contact
            </SortHeader>
            <MeetingHeader {...header} />
            <SortHeader {...header} sort="owner" className="w-[13%]">
              {OWNER_LABEL}
            </SortHeader>
            <SortHeader {...header} sort="rating" className="w-[18%]">
              How it went
            </SortHeader>
            <SortHeader {...header} sort="next_step" className="w-[19%]">
              Next step
            </SortHeader>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orgs.map((org, index) => (
            <OrgRow key={org.id ?? index} kind={kind} org={org} today={today} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrgRow({ kind, org, today }: { kind: OrgKind; org: OrgListItem; today: IsoDate }) {
  if (!org.id || !org.name) return null
  const location = locationText(org)
  const region = regionText(org)
  const contact = firstContact(org, today)
  return (
    <tr className="align-top">
      <th scope="row" className="px-3 py-3 font-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={orgHref(kind, org.id)}
            className="rounded-sm font-medium break-words text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {org.name}
          </Link>
          <span className="text-xs text-muted-foreground">{companyMeta(kind, org)}</span>
          {org.archived_at ? (
            <Badge variant="outline" className="mt-1">
              Archived
            </Badge>
          ) : null}
        </div>
      </th>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          {location ? <span className="break-words">{location}</span> : <Missing />}
          {region ? <span className="text-xs text-muted-foreground">{region}</span> : null}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          {contact.date && org.first_contact_date ? (
            <time dateTime={org.first_contact_date}>{contact.date}</time>
          ) : (
            <Missing />
          )}
          {contact.method ? (
            <span className="text-xs text-muted-foreground">{contact.method}</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3">
        <MeetingDatesText org={org} today={today} />
      </td>
      <td className="px-3 py-3">
        {org.owner_name ? (
          <PersonChip
            person={{ name: org.owner_name, avatarUrl: org.owner_avatar_url }}
            size="sm"
          />
        ) : (
          <Missing />
        )}
      </td>
      <td className="px-3 py-3">
        <HowItWent org={org} />
      </td>
      <td className="px-3 py-3">
        <NextStep org={org} today={today} />
      </td>
    </tr>
  )
}

type HeaderProps = { kind: OrgKind; filters: OrgFilters }

function SortIcon({ active, dir }: { active: boolean; dir: OrgFilters["dir"] }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", !active && "opacity-40")} />
}

const SORT_LINK =
  "inline-flex min-h-8 items-center gap-1 rounded-sm font-medium outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

function SortLink({
  kind,
  filters,
  sort,
  children,
}: HeaderProps & { sort: OrgSortKey; children: ReactNode }) {
  const active = filters.sort === sort
  return (
    <Link
      href={sortHref(kind, filters, sort)}
      scroll={false}
      className={cn(SORT_LINK, active && "text-foreground")}
    >
      {children}
      <SortIcon active={active} dir={filters.dir} />
    </Link>
  )
}

/** A column header that sorts by one key (aria-sort tells screen readers which way). */
function SortHeader({
  kind,
  filters,
  sort,
  className,
  children,
}: HeaderProps & { sort: OrgSortKey; className?: string; children: ReactNode }) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort(filters, [sort])}
      className={cn("px-3 py-2 align-bottom", className)}
    >
      <SortLink kind={kind} filters={filters} sort={sort}>
        {children}
      </SortLink>
    </th>
  )
}

/** "Meeting date" sorts by the latest meeting; "Next" beside it sorts by the next one. */
function MeetingHeader({ kind, filters }: HeaderProps) {
  return (
    <th
      scope="col"
      aria-sort={ariaSort(filters, ["latest_meeting", "next_meeting"])}
      className="w-[13%] px-3 py-2 align-bottom"
    >
      <span className="flex flex-wrap items-center gap-x-2">
        <SortLink kind={kind} filters={filters} sort="latest_meeting">
          Meeting date
        </SortLink>
        <SortLink kind={kind} filters={filters} sort="next_meeting">
          <span className="sr-only">Sort by next meeting</span>
          <span aria-hidden>Next</span>
        </SortLink>
      </span>
    </th>
  )
}
