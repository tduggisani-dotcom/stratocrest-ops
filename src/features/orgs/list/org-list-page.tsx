import { Suspense } from "react"
import Link from "next/link"
import { Download, Plus } from "lucide-react"
import { LiveRefresh } from "@/components/common/live-refresh"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { parseOrgFilters, serializeOrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { newOrgHref, orgExportHref } from "../links"
import { ORG_LIVE_TABLES } from "../types"
import { OrgListBody, type OrgSearchParams } from "./org-list-body"
import { OrgListSkeleton } from "./skeletons"

/**
 * The investor tracker and the customer pipeline (spec §6.2, §6.3): one page
 * for both, configured by `kind`. The header is static (the instant shell);
 * the list streams in behind Suspense and refreshes live when anyone,
 * including the bot, changes an org, a meeting or an owner.
 */
export function OrgListPage({
  kind,
  searchParams,
}: {
  kind: OrgKind
  searchParams: OrgSearchParams
}) {
  const config = kindConfig(kind)
  return (
    <>
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <PageHeader
        title={config.plural}
        description={config.description}
        actions={
          <>
            <Button asChild className="max-md:flex-1">
              <Link href={newOrgHref(kind)}>
                <Plus aria-hidden />
                {config.addLabel}
              </Link>
            </Button>
            {/* Until the URL is read, the button exports everything; then the filtered view. */}
            <Suspense fallback={<ExportCsvButton kind={kind} />}>
              <FilteredExportCsvButton kind={kind} searchParams={searchParams} />
            </Suspense>
          </>
        }
      />
      <Suspense fallback={<OrgListSkeleton kind={kind} />}>
        <OrgListBody kind={kind} searchParams={searchParams} />
      </Suspense>
    </>
  )
}

/** A plain download link (not <Link>): the export is a route handler that sends a file. */
function ExportCsvButton({ kind, query }: { kind: OrgKind; query?: string }) {
  return (
    <Button asChild variant="outline" className="max-md:flex-1">
      <a href={orgExportHref(kind, query)} download>
        <Download aria-hidden />
        Export CSV
      </a>
    </Button>
  )
}

/** The export link for the filters in the URL (the view doesn't matter to a CSV). */
async function FilteredExportCsvButton({
  kind,
  searchParams,
}: {
  kind: OrgKind
  searchParams: OrgSearchParams
}) {
  const filters = parseOrgFilters(kind, await searchParams)
  return <ExportCsvButton kind={kind} query={serializeOrgFilters(filters, { view: "table" })} />
}
