import "server-only"
import { cache } from "react"
import type { OrgKind } from "@/features/orgs/kind-config"
import { formatDate, formatTime, toEtDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import { createClient } from "@/lib/supabase/server"
import type { HypothesisFilters } from "./filters"
import { newestFirst, summarizeEvidence } from "./summary"
import type {
  EvidenceEntry,
  HypothesisDetail,
  HypothesisListItem,
  MeetingOption,
  OrgOption,
  TestOutcome,
} from "./types"

/**
 * Reads for the hypothesis log (org page), the roll-up and a hypothesis's
 * page. Server-only; each runs as the signed-in person (RLS applies) and
 * throws on a database error so the section shows its retry screen. Call them
 * inside <Suspense>, after requireTeamMember().
 */

const LIST_COLUMNS = `
  id, statement, status, decision, audience, archived_at, created_at,
  organization:organizations!hypotheses_organization_id_fkey ( id, name, kind, archived_at ),
  owner:people!hypotheses_owner_id_fkey ( id, name, avatar_url ),
  tests:hypothesis_tests ( test_date, outcome, evidence, created_at )`

type ListRow = {
  id: string
  statement: string
  status: HypothesisListItem["status"]
  decision: HypothesisListItem["decision"]
  audience: OrgKind | null
  archived_at: string | null
  created_at: string
  organization: { id: string; name: string; kind: OrgKind; archived_at: string | null } | null
  owner: { id: string; name: string; avatar_url: string | null } | null
  tests: { test_date: string; outcome: TestOutcome; evidence: string; created_at: string }[]
}

function toListItem(row: ListRow): HypothesisListItem {
  const org = row.organization
  return {
    id: row.id,
    statement: row.statement,
    status: row.status,
    decision: row.decision,
    audience: org?.kind ?? row.audience,
    org: org
      ? { id: org.id, name: org.name, kind: org.kind, archived: org.archived_at !== null }
      : null,
    owner: row.owner
      ? { id: row.owner.id, name: row.owner.name, avatarUrl: row.owner.avatar_url }
      : null,
    evidence: summarizeEvidence(row.tests),
    archived: row.archived_at !== null,
    createdAt: row.created_at,
  }
}

/** One org's active hypotheses, newest first (the org page's hypothesis log). */
export async function listOrgHypotheses(orgId: string): Promise<HypothesisListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hypotheses")
    .select(LIST_COLUMNS)
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Couldn't load the hypotheses: ${error.message}`)
  return (data as ListRow[]).map(toListItem)
}

/** True when the org is archived (its page shows the log, but nothing new is added). */
export async function isOrgArchived(orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("archived_at")
    .eq("id", orgId)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the record: ${error.message}`)
  return data?.archived_at != null
}

/** Every hypothesis matching the roll-up's filters (grouped by status on the page). */
export async function listHypotheses(filters: HypothesisFilters): Promise<HypothesisListItem[]> {
  const supabase = await createClient()
  let query = supabase.from("hypotheses").select(LIST_COLUMNS)
  query = filters.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null)
  if (filters.audience) query = query.eq("audience", filters.audience)
  if (filters.owner === "none") query = query.is("owner_id", null)
  else if (filters.owner) query = query.eq("owner_id", filters.owner)
  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) throw new Error(`Couldn't load the hypotheses: ${error.message}`)
  return (data as ListRow[]).map(toListItem)
}

/** How many hypotheses are archived (for "Show archived (n)"). */
export async function countArchivedHypotheses(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("hypotheses")
    .select("id", { count: "exact", head: true })
    .not("archived_at", "is", null)
  if (error) throw new Error(`Couldn't count archived hypotheses: ${error.message}`)
  return count ?? 0
}

const DETAIL_COLUMNS = `
  id, statement, status, decision, audience, archived_at, created_at, updated_at,
  test_plan, success_criterion, result, learning,
  organization:organizations!hypotheses_organization_id_fkey ( id, name, kind, archived_at ),
  owner:people!hypotheses_owner_id_fkey ( id, name, avatar_url ),
  tests:hypothesis_tests (
    id, test_date, outcome, evidence, created_at,
    meeting:org_meetings!hypothesis_tests_org_meeting_id_fkey (
      id, starts_at,
      organization:organizations!org_meetings_organization_id_fkey ( id, name, kind )
    )
  )`

type DetailRow = Omit<ListRow, "tests"> & {
  updated_at: string
  test_plan: string | null
  success_criterion: string | null
  result: string | null
  learning: string | null
  tests: {
    id: string
    test_date: string
    outcome: TestOutcome
    evidence: string
    created_at: string
    meeting: {
      id: string
      starts_at: string
      organization: { id: string; name: string; kind: OrgKind } | null
    } | null
  }[]
}

/** One hypothesis (archived ones too), or null for an unknown or malformed id. */
export const getHypothesis = cache(async (id: string): Promise<HypothesisDetail | null> => {
  if (!isRecordId(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hypotheses")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the hypothesis: ${error.message}`)
  if (!data) return null
  const row = data as unknown as DetailRow
  const tests: EvidenceEntry[] = newestFirst(row.tests).map((test) => ({
    id: test.id,
    testDate: test.test_date,
    outcome: test.outcome,
    evidence: test.evidence,
    createdAt: test.created_at,
    meeting:
      test.meeting && test.meeting.organization
        ? { id: test.meeting.id, startsAt: test.meeting.starts_at, org: test.meeting.organization }
        : null,
  }))
  return {
    ...toListItem(row),
    testPlan: row.test_plan,
    successCriterion: row.success_criterion,
    result: row.result,
    learning: row.learning,
    tests,
    updatedAt: row.updated_at,
  }
})

/**
 * Investors and customers a hypothesis can be about: every active one, plus
 * `currentId` if it is archived (so an edit form still shows it). By kind, then name.
 */
export async function getOrgOptions(currentId?: string | null): Promise<OrgOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, kind, archived_at")
    .order("kind")
    .order("name")
  if (error) throw new Error(`Couldn't load investors and customers: ${error.message}`)
  return data
    .filter((org) => org.archived_at === null || org.id === currentId)
    .map(({ id, name, kind }) => ({ id, name, kind }))
}

/** How many meetings the evidence form offers. */
const MEETING_OPTION_LIMIT = 60

/**
 * Meetings evidence can come from, newest first: the org's meetings that have
 * started (or, for a hypothesis across many, those of every org of its
 * audience), plus `currentId` so an edit keeps its link.
 */
export async function getMeetingOptions(
  hypothesis: Pick<HypothesisDetail, "org" | "audience">,
  currentIds: string[] = [],
): Promise<MeetingOption[]> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  let query = supabase
    .from("org_meetings")
    .select("id, starts_at, organization:organizations!inner ( id, name, kind )")
    .lte("starts_at", now)
  if (hypothesis.org) query = query.eq("organization_id", hypothesis.org.id)
  else if (hypothesis.audience) query = query.eq("organization.kind", hypothesis.audience)
  else return []
  const { data, error } = await query
    .order("starts_at", { ascending: false })
    .limit(MEETING_OPTION_LIMIT)
  if (error) throw new Error(`Couldn't load meetings: ${error.message}`)

  const rows = [...data]
  const missing = currentIds.filter((id) => !rows.some((row) => row.id === id))
  if (missing.length > 0) {
    const extra = await supabase
      .from("org_meetings")
      .select("id, starts_at, organization:organizations!inner ( id, name, kind )")
      .in("id", missing)
    if (extra.error) throw new Error(`Couldn't load meetings: ${extra.error.message}`)
    rows.push(...extra.data)
  }

  return rows.map((row) => ({
    id: row.id,
    label: meetingLabel(row.starts_at, hypothesis.org ? null : row.organization.name),
  }))
}

/** "Wed, Oct 7, 2:00 PM", with the org's name first for a hypothesis across many. */
export function meetingLabel(startsAt: string, orgName: string | null): string {
  const when = `${formatDate(toEtDate(startsAt))}, ${formatTime(startsAt)}`
  return orgName ? `${orgName} · ${when}` : when
}
