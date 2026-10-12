import Link from "next/link"
import { Archive, Plus, SearchX, Users } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { Button } from "@/components/ui/button"
import type { OrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { newOrgHref } from "../links"
import { archivedToggleHref, clearFiltersHref } from "./filter-options"

/** Before the first investor (or customer): what goes here, and a button to add one. */
export function NoOrgs({ kind }: { kind: OrgKind }) {
  const config = kindConfig(kind)
  return (
    <EmptyState
      icon={Users}
      title={config.emptyTitle}
      description={config.emptyDescription}
      action={
        <Button asChild className="max-md:w-full">
          <Link href={newOrgHref(kind)}>
            <Plus aria-hidden />
            {config.addLabel}
          </Link>
        </Button>
      }
    />
  )
}

/** Filters (or a search) that match nothing. */
export function NoMatches({ kind, filters }: { kind: OrgKind; filters: OrgFilters }) {
  const config = kindConfig(kind)
  const plural = config.plural.toLowerCase()
  return (
    <EmptyState
      icon={SearchX}
      title={`No ${plural} match these filters`}
      description={`Try fewer filters, or clear them to see every ${config.singular.toLowerCase()}.`}
      action={
        <Button asChild variant="outline" className="max-md:w-full">
          <Link href={clearFiltersHref(kind, filters)} scroll={false}>
            Clear filters
          </Link>
        </Button>
      }
    />
  )
}

/** The archived list when nothing has been archived. */
export function NoArchived({ kind, filters }: { kind: OrgKind; filters: OrgFilters }) {
  const config = kindConfig(kind)
  const plural = config.plural.toLowerCase()
  return (
    <EmptyState
      icon={Archive}
      title={`No archived ${plural}`}
      description={`${config.plural} you archive from their page show up here, with their meetings and notes kept for the record.`}
      action={
        <Button asChild variant="outline" className="max-md:w-full">
          <Link href={archivedToggleHref(kind, filters)} scroll={false}>
            Back to active {plural}
          </Link>
        </Button>
      }
    />
  )
}
