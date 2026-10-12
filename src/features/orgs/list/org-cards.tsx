import Link from "next/link"
import { CalendarDays, MapPin } from "lucide-react"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import type { IsoDate } from "@/lib/dates"
import { kindConfig, OWNER_LABEL, type OrgKind } from "../kind-config"
import { orgHref } from "../links"
import type { OrgListItem } from "../queries/list"
import { HowItWent, MeetingDatesText, NextStep } from "./cells"
import { companyMeta, locationText, regionText } from "./display"

/**
 * The tracker on phones (below md): one card per org with what the spec asks
 * for (company, location, meeting date, point of contact, rating), plus the
 * next step and the stale marker. The whole card is the company link, so the
 * tap target is large.
 */
export function OrgCards({
  kind,
  orgs,
  today,
}: {
  kind: OrgKind
  orgs: readonly OrgListItem[]
  today: IsoDate
}) {
  return (
    <ul aria-label={kindConfig(kind).plural} className="space-y-3 md:hidden">
      {orgs.map((org, index) => (
        <OrgCard key={org.id ?? index} kind={kind} org={org} today={today} />
      ))}
    </ul>
  )
}

function OrgCard({ kind, org, today }: { kind: OrgKind; org: OrgListItem; today: IsoDate }) {
  if (!org.id || !org.name) return null
  const location = [locationText(org), regionText(org)].filter(Boolean).join(" · ")
  return (
    <li className="relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="font-medium break-words">
            {/* Stretched over the card: tapping anywhere opens the org. */}
            <Link
              href={orgHref(kind, org.id)}
              className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {org.name}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{companyMeta(kind, org)}</p>
        </div>
        {org.archived_at ? <Badge variant="outline">Archived</Badge> : null}
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        {location ? (
          <p className="flex items-start gap-2">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Location: </span>
            <span className="min-w-0 break-words">{location}</span>
          </p>
        ) : null}
        <div className="flex items-start gap-2">
          <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">Meetings: </span>
          <MeetingDatesText org={org} today={today} />
        </div>
      </div>

      {org.owner_name ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="sr-only">{OWNER_LABEL}: </span>
          <PersonChip
            person={{ name: org.owner_name, avatarUrl: org.owner_avatar_url }}
            size="sm"
          />
        </div>
      ) : null}

      <HowItWent org={org} />

      <div className="border-t pt-3">
        <span className="sr-only">Next step: </span>
        <NextStep org={org} today={today} />
      </div>
    </li>
  )
}
