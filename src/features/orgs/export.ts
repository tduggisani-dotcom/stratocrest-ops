import "server-only"
import { requireTeamMember } from "@/lib/auth"
import { APP_TIME_ZONE, todayEt, toEtDate, type IsoDate } from "@/lib/dates"
import { contactMethodLabels, orgRegionLabels, orgStageLabel, orgSubtypeLabels } from "@/lib/labels"
import { toCsv, type CsvCell } from "./csv"
import { parseOrgFilters, type OrgFilters } from "./filters"
import { kindConfig, OWNER_LABEL, type OrgKind } from "./kind-config"
import { listOrgs, type OrgListItem } from "./queries/list"

/**
 * CSV export of the tracker's current filtered view (spec §6.2). Both
 * kinds' route handlers (/investors/export, /customers/export) call
 * exportOrgsCsv; the query string is the list page's own, so the file holds
 * exactly the rows the table shows, in the same order.
 */

const etClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** A moment as ET wall-clock time, "YYYY-MM-DD HH:MM" (sorts as text, reads in any spreadsheet). */
export function etStamp(instant: string): string {
  return `${toEtDate(instant)} ${etClock.format(new Date(instant))}`
}

function stamp(instant: string | null): string | null {
  return instant ? etStamp(instant) : null
}

/** The header row. The focus column takes the kind's own label. */
export function orgCsvHeader(kind: OrgKind): string[] {
  return [
    "Company",
    "Stage",
    "Subtype",
    OWNER_LABEL,
    "Next step",
    "Next step date",
    "City",
    "State or country",
    "Region",
    "First contact date",
    "First contact method",
    "Introduced by",
    kindConfig(kind).focusLabel,
    "Contact name",
    "Contact title",
    "Contact email",
    "Contact phone",
    "Link",
    "Last contact",
    "Days since contact",
    "Stale",
    "Latest meeting",
    "Latest rating",
    "Latest summary",
    "Next meeting",
  ]
}

/** One org as a row: labels (not stored values), days as YYYY-MM-DD, moments in ET. */
export function orgCsvRow(kind: OrgKind, org: OrgListItem): CsvCell[] {
  return [
    org.name,
    org.stage_label ?? (org.stage ? orgStageLabel(kind, org.stage) : null),
    org.subtype ? orgSubtypeLabels[org.subtype] : null,
    org.owner_name,
    org.next_step,
    org.next_step_date,
    org.city,
    org.state_or_country,
    org.region ? orgRegionLabels[org.region] : null,
    org.first_contact_date,
    org.first_contact_method ? contactMethodLabels[org.first_contact_method] : null,
    org.introduced_by,
    org.check_size_or_focus,
    org.contact_name,
    org.contact_title,
    org.contact_email,
    org.contact_phone,
    org.link,
    org.last_contact_date,
    org.days_since_contact,
    org.is_stale === null ? null : org.is_stale ? "Yes" : "No",
    stamp(org.latest_meeting_at),
    org.latest_rating,
    org.latest_summary,
    stamp(org.next_meeting_at),
  ]
}

export function orgsCsv(kind: OrgKind, orgs: readonly OrgListItem[]): string {
  return toCsv([orgCsvHeader(kind), ...orgs.map((org) => orgCsvRow(kind, org))])
}

/** "investors-2026-10-12.csv" (ET today); "investors-archived-…" for the archived list. */
export function exportFilename(kind: OrgKind, filters: OrgFilters, today: IsoDate): string {
  const name = kindConfig(kind).plural.toLowerCase()
  return `${name}${filters.archived ? "-archived" : ""}-${today}.csv`
}

const NO_STORE = { "Cache-Control": "no-store" }

/** The GET handler behind /investors/export and /customers/export. */
export async function exportOrgsCsv(kind: OrgKind, request: Request): Promise<Response> {
  // Signed-out visitors never get here (src/proxy.ts sends them to sign in);
  // this also turns away a deactivated teammate, like every page does.
  await requireTeamMember()

  const filters = parseOrgFilters(kind, new URL(request.url).searchParams)
  let orgs: OrgListItem[]
  try {
    orgs = await listOrgs(kind, filters)
  } catch (error) {
    console.error("Exporting the list failed", error)
    return new Response(`Couldn't export ${kindConfig(kind).plural.toLowerCase()}. Try again.`, {
      status: 503,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  return new Response(orgsCsv(kind, orgs), {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(kind, filters, todayEt())}"`,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
