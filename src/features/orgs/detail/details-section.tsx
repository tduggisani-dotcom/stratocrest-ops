import type { ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, Pencil, UserRound } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/features/this-week/components/section-card"
import { formatDate, relativeDay, type IsoDate } from "@/lib/dates"
import { contactMethodLabels, orgKindLabels, orgRegionLabels } from "@/lib/labels"
import { otherOrgKind } from "@/lib/schemas/organizations"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import { editOrgHref, orgHref } from "../links"
import type { OrgDetail } from "../queries/detail"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "./resolve"
import { ORG_SECTIONS } from "./sections"
import { displayLink, locationLine, telHref } from "./format"

/**
 * Who to talk to and how we know them: contact, link, location, how we met,
 * the kind's focus (check size / need), last contact, the linked key result,
 * the same company on the other list, and notes. Only what's filled in shows;
 * with nothing yet, an empty state points at Edit.
 */
export async function OrgDetailsSection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const org = await orgOrNotFound(kind, await orgIdFrom(params))
  const today = requestToday()
  const { id, title } = ORG_SECTIONS.details
  const archived = org.archivedAt !== null
  const editButton = archived ? null : (
    <Button asChild variant="outline">
      <Link href={editOrgHref(kind, org.id)}>
        <Pencil aria-hidden />
        Edit details
      </Link>
    </Button>
  )
  const facts = detailFacts(org, today)

  if (facts.length === 0 && !org.notes) {
    return (
      <SectionCard id={id} title={title}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={UserRound}
          title="No contact details yet"
          description={`Add who we talk to at ${org.name}, how to reach them, where they are, how we met and their ${kindConfig(kind).focusLabel.toLowerCase()}, so anyone on the team can pick this up.`}
          action={editButton}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard id={id} title={title} action={editButton}>
      {facts.length > 0 ? (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className={cn("min-w-0 space-y-1", fact.wide && "sm:col-span-2")}>
              <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm break-words">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {org.notes ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground">Notes</h3>
          <p className="text-sm whitespace-pre-wrap break-words">{org.notes}</p>
        </div>
      ) : null}
    </SectionCard>
  )
}

type Fact = { label: string; value: ReactNode; wide?: boolean }

const LINK = "text-primary underline-offset-4 hover:underline"
/** Phones: the link's line is a 44 px target. */
const TAP = "inline-flex min-h-11 items-center md:min-h-0"

function detailFacts(org: OrgDetail, today: IsoDate): Fact[] {
  const facts: Fact[] = []

  const who = [org.contactName, org.contactTitle].filter(Boolean).join(", ")
  if (who) facts.push({ label: "Contact", value: who })
  if (org.contactEmail) {
    facts.push({
      label: "Email",
      value: (
        <a href={`mailto:${org.contactEmail}`} className={cn(LINK, TAP, "break-all")}>
          {org.contactEmail}
        </a>
      ),
    })
  }
  if (org.contactPhone) {
    const tel = telHref(org.contactPhone)
    facts.push({
      label: "Phone",
      value: tel ? (
        <a href={tel} className={cn(LINK, TAP)}>
          {org.contactPhone}
        </a>
      ) : (
        org.contactPhone
      ),
    })
  }
  if (org.link) {
    facts.push({
      label: "Link",
      value: (
        <a
          href={org.link}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(LINK, TAP, "gap-1 break-all")}
        >
          {displayLink(org.link)}
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ),
    })
  }

  const location = locationLine(org.city, org.stateOrCountry)
  if (location || org.region) {
    facts.push({
      label: "Location",
      value: [location, org.region ? orgRegionLabels[org.region] : null]
        .filter(Boolean)
        .join(" · "),
    })
  }

  if (org.firstContactDate || org.firstContactMethod) {
    facts.push({
      label: "First contact",
      value: [
        org.firstContactDate ? formatDate(org.firstContactDate, "long") : null,
        org.firstContactMethod ? contactMethodLabels[org.firstContactMethod] : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })
  }
  if (org.introducedBy) facts.push({ label: "Introduced by", value: org.introducedBy })
  if (org.checkSizeOrFocus) {
    facts.push({ label: kindConfig(org.kind).focusLabel, value: org.checkSizeOrFocus, wide: true })
  }

  if (org.manualLastContactDate) {
    facts.push({
      label: "Last contact outside meetings",
      value: `${formatDate(org.manualLastContactDate, "short")} · ${relativeDay(org.manualLastContactDate, today)}`,
    })
  }

  if (org.keyResult) {
    const kr = org.keyResult
    facts.push({
      label: "Key result",
      value: (
        <Link href="/okrs" className={cn(LINK, TAP)}>
          {[kr.quarterLabel, kr.title].filter(Boolean).join(" · ")}
          {kr.archived ? " (archived)" : ""}
        </Link>
      ),
    })
  }
  if (org.related) {
    const related = org.related
    facts.push({
      label: `Also tracked as ${orgKindLabels[otherOrgKind(org.kind)].singular.toLowerCase()}`,
      value: (
        <Link href={orgHref(related.kind, related.id)} className={cn(LINK, TAP)}>
          {related.name}
          {related.archived ? " (archived)" : ""}
        </Link>
      ),
    })
  }
  return facts
}
