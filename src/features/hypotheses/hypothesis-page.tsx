import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Archive, ChevronLeft, MessageSquareQuote, Pencil, Plus } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { LiveRefresh } from "@/components/common/live-refresh"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { kindConfig } from "@/features/orgs/kind-config"
import { hypothesesHref, meetingHref, orgHref } from "@/features/orgs/links"
import { ORG_LIVE_TABLES } from "@/features/orgs/types"
import { SectionCard } from "@/features/this-week/components/section-card"
import { requireTeamMember } from "@/lib/auth"
import { getActivePeople } from "@/lib/data/people"
import { formatDate, toEtDate, todayEt, type IsoDate } from "@/lib/dates"
import { hypothesisDecisionLabels, orgKindLabels } from "@/lib/labels"
import { ArchiveHypothesisButton, RestoreHypothesisButton } from "./archive-buttons"
import { DecisionBadge, HypothesisStatusBadge, OutcomeBadge } from "./badges"
import { DisclosurePanel, DisclosureScope, DisclosureToggle } from "./disclosure"
import { EvidenceForm } from "./evidence-form"
import { HypothesisForm, type HypothesisFormDefaults } from "./hypothesis-form"
import { getHypothesis, getMeetingOptions, getOrgOptions } from "./queries"
import { HypothesisPageSkeleton } from "./skeletons"
import { HypothesisStatusMenu } from "./status-menu"
import { evidenceText } from "./summary"
import type { EvidenceEntry, HypothesisDetail, MeetingOption } from "./types"

type HypothesisParams = Promise<{ id: string }>

/**
 * One hypothesis: the statement with its status (changeable in place) and
 * decision, who it's about and who owns it; the evidence trail (newest
 * first) with "Add evidence"; and the edit form for everything else.
 * Archived ones keep their page, read-only, with Restore. Unknown ids are
 * this route's 404. The back link is static (the instant shell).
 */
export function HypothesisPageView({ params }: { params: HypothesisParams }) {
  return (
    <div className="mx-auto max-w-3xl">
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <Button asChild variant="ghost" className="mb-2 -ml-3 text-muted-foreground">
        <Link href={hypothesesHref()}>
          <ChevronLeft aria-hidden />
          Hypotheses
        </Link>
      </Button>
      <Suspense fallback={<HypothesisPageSkeleton />}>
        <HypothesisBody params={params} />
      </Suspense>
    </div>
  )
}

async function HypothesisBody({ params }: { params: HypothesisParams }) {
  const [{ id }] = await Promise.all([params, requireTeamMember()])
  const hypothesis = await getHypothesis(id)
  if (!hypothesis) notFound()

  const today = todayEt()
  const meetingIds = hypothesis.tests.flatMap((test) => (test.meeting ? [test.meeting.id] : []))
  const [people, orgs, meetings] = await Promise.all([
    getActivePeople(),
    getOrgOptions(hypothesis.org?.id),
    getMeetingOptions(hypothesis, meetingIds),
  ])
  // The owner stays pickable even after leaving the team.
  const owner = hypothesis.owner
  const owners = [
    ...people,
    ...(owner && !people.some((p) => p.id === owner.id) ? [owner] : []),
  ].map(({ id, name }) => ({ id, name }))

  return (
    <div className="space-y-6 md:space-y-8">
      <HypothesisHeader hypothesis={hypothesis} />
      <EvidenceSection hypothesis={hypothesis} meetings={meetings} today={today} />
      <SectionCard
        id="hypothesis-details"
        title="Details"
        description="How we're testing it, what would validate it, and what we learned."
      >
        {hypothesis.archived ? (
          <ReadOnlyDetails hypothesis={hypothesis} />
        ) : (
          <HypothesisForm
            mode="edit"
            hypothesisId={hypothesis.id}
            orgs={orgs}
            people={owners}
            defaults={editDefaults(hypothesis)}
          />
        )}
      </SectionCard>
      {hypothesis.archived ? null : (
        <div className="flex justify-end">
          <ArchiveHypothesisButton id={hypothesis.id} />
        </div>
      )}
    </div>
  )
}

/** The edit form's starting values: the saved ones, as strings. */
export function editDefaults(h: HypothesisDetail): HypothesisFormDefaults {
  return {
    statement: h.statement,
    about: h.org?.id ?? h.audience ?? "",
    owner_id: h.owner?.id ?? "",
    test_plan: h.testPlan ?? "",
    success_criterion: h.successCriterion ?? "",
    result: h.result ?? "",
    learning: h.learning ?? "",
    decision: h.decision ?? "",
  }
}

function HypothesisHeader({ hypothesis }: { hypothesis: HypothesisDetail }) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hypothesis.archived ? (
          <>
            <HypothesisStatusBadge status={hypothesis.status} />
            <Badge variant="secondary">
              <Archive aria-hidden />
              Archived
            </Badge>
          </>
        ) : (
          <HypothesisStatusMenu id={hypothesis.id} status={hypothesis.status} />
        )}
        {hypothesis.decision ? <DecisionBadge decision={hypothesis.decision} /> : null}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-pretty break-words">
        {hypothesis.statement}
      </h1>
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">About</dt>
          <dd className="min-w-0">
            <AboutValue hypothesis={hypothesis} />
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Owner</dt>
          <dd className="min-w-0">
            {hypothesis.owner ? (
              <PersonChip person={hypothesis.owner} size="sm" />
            ) : (
              <span className="text-muted-foreground">Nobody yet</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Evidence</dt>
          <dd>{evidenceText(hypothesis.evidence)}</dd>
        </div>
      </dl>
      {hypothesis.archived ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border bg-muted/50 p-4 md:flex-row md:items-center md:justify-between"
        >
          <p className="flex items-start gap-2 text-sm">
            <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-medium">Archived.</span> It isn&apos;t on the roll-up or its
              org&apos;s page. Restore it to change it or add evidence.
            </span>
          </p>
          <RestoreHypothesisButton id={hypothesis.id} />
        </div>
      ) : null}
    </header>
  )
}

/** "Customer: Acme Steel" (a link), or "Across customers". */
function AboutValue({ hypothesis }: { hypothesis: HypothesisDetail }) {
  const org = hypothesis.org
  if (org) {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-1">
        <span className="text-muted-foreground">{kindConfig(org.kind).singular}:</span>
        <Link
          href={orgHref(org.kind, org.id)}
          className="inline-flex min-h-11 min-w-0 items-center rounded-md font-medium break-words underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-0"
        >
          {org.name}
        </Link>
        {org.archived ? <span className="text-muted-foreground">(archived)</span> : null}
      </span>
    )
  }
  return (
    <span>
      {hypothesis.audience
        ? `Across ${orgKindLabels[hypothesis.audience].plural.toLowerCase()}`
        : "Across many"}
    </span>
  )
}

function EvidenceSection({
  hypothesis,
  meetings,
  today,
}: {
  hypothesis: HypothesisDetail
  meetings: MeetingOption[]
  today: IsoDate
}) {
  const { tests, archived } = hypothesis
  const addForm = archived ? null : (
    <DisclosurePanel label="Add evidence">
      <EvidenceForm
        mode="create"
        hypothesisId={hypothesis.id}
        meetings={meetings}
        defaults={{ test_date: today }}
      />
    </DisclosurePanel>
  )
  return (
    <DisclosureScope>
      <SectionCard
        id="hypothesis-evidence"
        title="Evidence"
        count={{
          value: tests.length,
          label: tests.length === 1 ? "piece of evidence" : "pieces of evidence",
        }}
        description="What each conversation or test showed, newest first."
        action={
          !archived && tests.length > 0 ? (
            <DisclosureToggle variant="outline">
              <Plus aria-hidden />
              Add evidence
            </DisclosureToggle>
          ) : null
        }
      >
        {tests.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            titleAs="h3"
            size="compact"
            title="No evidence yet"
            description="After a conversation that tests this, add what it showed and what we heard. The status is yours to change once the evidence is in."
            action={
              archived ? null : (
                <DisclosureToggle className="max-md:w-full">
                  <Plus aria-hidden />
                  Add evidence
                </DisclosureToggle>
              )
            }
          />
        ) : null}
        {addForm}
        {tests.length > 0 ? (
          <ol className="flex flex-col divide-y">
            {tests.map((entry) => (
              <EvidenceItem
                key={entry.id}
                entry={entry}
                meetings={meetings}
                showOrg={hypothesis.org === null}
                editable={!archived}
              />
            ))}
          </ol>
        ) : null}
      </SectionCard>
    </DisclosureScope>
  )
}

/** One entry of the trail: when, what it showed, what we heard, and its meeting. */
function EvidenceItem({
  entry,
  meetings,
  showOrg,
  editable,
}: {
  entry: EvidenceEntry
  meetings: MeetingOption[]
  /** For a hypothesis across many, say which org the meeting was with. */
  showOrg: boolean
  editable: boolean
}) {
  const meeting = entry.meeting
  return (
    <li
      data-evidence-id={entry.id}
      tabIndex={-1}
      className="space-y-2 py-4 outline-none first:pt-0 last:pb-0 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <time dateTime={entry.testDate} className="text-sm font-medium">
          {formatDate(entry.testDate)}
        </time>
        <OutcomeBadge outcome={entry.outcome} />
      </div>
      <p className="text-sm whitespace-pre-line break-words">{entry.evidence}</p>
      {meeting ? (
        <p className="text-sm">
          <Link
            href={meetingHref(meeting.org.kind, meeting.org.id, meeting.id)}
            className="inline-flex min-h-11 items-center rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-0"
          >
            From the meeting{showOrg ? ` with ${meeting.org.name}` : ""} on{" "}
            {formatDate(toEtDate(meeting.startsAt))}
          </Link>
        </p>
      ) : null}
      {editable ? (
        <DisclosureScope>
          <DisclosureToggle
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground max-md:h-11"
          >
            <Pencil aria-hidden />
            Edit<span className="sr-only"> evidence from {formatDate(entry.testDate)}</span>
          </DisclosureToggle>
          <DisclosurePanel label={`Edit evidence from ${formatDate(entry.testDate)}`}>
            <EvidenceForm
              mode="edit"
              testId={entry.id}
              meetings={meetings}
              defaults={{
                test_date: entry.testDate,
                outcome: entry.outcome,
                evidence: entry.evidence,
                org_meeting_id: meeting?.id ?? "",
              }}
            />
          </DisclosurePanel>
        </DisclosureScope>
      ) : null}
    </li>
  )
}

/** An archived hypothesis's details, read-only. */
function ReadOnlyDetails({ hypothesis }: { hypothesis: HypothesisDetail }) {
  const rows: [string, string | null][] = [
    ["How we'll test it", hypothesis.testPlan],
    ["What would validate it", hypothesis.successCriterion],
    ["What happened", hypothesis.result],
    ["What we learned", hypothesis.learning],
    ["Decision", hypothesis.decision ? hypothesisDecisionLabels[hypothesis.decision] : null],
  ]
  return (
    <dl className="space-y-4">
      {rows.map(([label, value]) => (
        <div key={label} className="space-y-1">
          <dt className="text-sm font-medium">{label}</dt>
          <dd className="text-sm whitespace-pre-line break-words text-muted-foreground">
            {value ?? "Not written down."}
          </dd>
        </div>
      ))}
    </dl>
  )
}
