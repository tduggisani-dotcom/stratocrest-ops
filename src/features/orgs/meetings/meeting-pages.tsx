import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Archive, ChevronLeft, ChevronRight, CircleCheck, Clock } from "lucide-react"
import { LiveRefresh } from "@/components/common/live-refresh"
import { PersonChip, firstNameOf } from "@/components/common/person-chip"
import { PageHeader } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DebriefPanel } from "@/features/debriefs/debrief-panel"
import { getOrgMeetingDebrief } from "@/features/debriefs/queries"
import { newTaskHref } from "@/features/tasks/links"
import { SectionCard } from "@/features/this-week/components/section-card"
import { requireTeamMember } from "@/lib/auth"
import { addDays, formatDate, formatDateTime, toEtDate } from "@/lib/dates"
import { isRecordId } from "@/lib/schemas/people"
import { BackToOrgs } from "../detail/back-link"
import { orgIdFrom, requestToday } from "../detail/resolve"
import { OrgFormSkeleton } from "../detail/skeletons"
import { OWNER_LABEL, kindConfig, type OrgKind } from "../kind-config"
import { meetingHref, orgHref } from "../links"
import { ORG_LIVE_TABLES } from "../types"
import { FocusHeading } from "./focus-heading"
import { FollowUpTaskButton } from "./follow-up-button"
import { attendeeChoices, defaultMeetingMoment, etTimeOf, followUpTaskDraft } from "./helpers"
import { MeetingDetails } from "./meeting-details"
import { MeetingForm, type MeetingFormDefaults } from "./meeting-form"
import { MeetingTaskList } from "./meeting-tasks"
import {
  followUpTaskOf,
  getMeeting,
  getMeetingOrg,
  getMeetingPeople,
  getMeetingTasks,
  metSince,
  type MeetingDetail,
  type MeetingPerson,
} from "./queries"

/**
 * The two screens of logging a meeting (spec §6.2: "≤ 2 screens, then prompts
 * a debrief and a follow-up task (one click)"), shared by investors and
 * customers. Route files render these with their kind. Each page's frame is
 * static (the instant shell); the data streams in behind <Suspense> and
 * refreshes live.
 */

type OrgRouteParams = Promise<{ id: string }>
type MeetingRouteParams = Promise<{ id: string; meetingId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Days from today a follow-up is due unless changed. */
const DEFAULT_FOLLOW_UP_IN_DAYS = 7

// ---------------------------------------------------------------------------
// Screen 1: /investors/<id>/meetings/new
// ---------------------------------------------------------------------------

export function NewMeetingPage({ kind, params }: { kind: OrgKind; params: OrgRouteParams }) {
  return (
    <div className="max-w-2xl">
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <Suspense fallback={<BackToOrgs kind={kind} />}>
        <BackToOrg kind={kind} params={params} />
      </Suspense>
      <PageHeader
        title="Log a meeting"
        description="Who went, how it went, and who follows up. The debrief and a follow-up task come next."
      />
      <Suspense fallback={<OrgFormSkeleton />}>
        <NewMeetingForm kind={kind} params={params} />
      </Suspense>
    </div>
  )
}

/** "‹ Acme Ventures": back to the org (its name streams in; "‹ Investors" until then). */
async function BackToOrg({ kind, params }: { kind: OrgKind; params: OrgRouteParams }) {
  const id = await orgIdFrom(params)
  const org = await getMeetingOrg(kind, id)
  if (!org) return <BackToOrgs kind={kind} />
  return <BackLink href={orgHref(kind, org.id)}>{org.name}</BackLink>
}

function BackLink({ href, children }: { href: ReturnType<typeof orgHref>; children: string }) {
  return (
    <Button asChild variant="ghost" className="mb-2 -ml-3 max-w-full text-muted-foreground">
      <Link href={href}>
        <ChevronLeft aria-hidden />
        <span className="truncate">{children}</span>
      </Link>
    </Button>
  )
}

/**
 * The form, prefilled: now (rounded down to the quarter hour, ET), me and the
 * org's point of contact as our side, the point of contact following up in a
 * week, and the org's current next step.
 */
async function NewMeetingForm({ kind, params }: { kind: OrgKind; params: OrgRouteParams }) {
  const id = await orgIdFrom(params)
  const [me, org, active] = await Promise.all([
    requireTeamMember(),
    getMeetingOrg(kind, id),
    getMeetingPeople(),
  ])
  if (!org) notFound()
  if (org.archivedAt) return <ArchivedNotice kind={kind} orgId={org.id} orgName={org.name} />

  const now = new Date()
  const today = requestToday()
  const { date, time } = defaultMeetingMoment(now)
  const isActive = (personId: string) => active.some((p) => p.id === personId)
  const ourSide = [...new Set([me.id, org.owner.id])].filter(isActive)
  const followUpOwner = isActive(org.owner.id) ? org.owner.id : ""

  const defaults: MeetingFormDefaults = {
    meeting_date: date,
    meeting_time: time,
    attendee_ids: ourSide.join(","),
    rating: "",
    follow_up_owner_id: followUpOwner,
    follow_up_date: followUpOwner ? addDays(today, DEFAULT_FOLLOW_UP_IN_DAYS) : "",
    next_step: org.nextStep,
    next_step_date: org.nextStepDate,
  }

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>
          With <span className="font-medium text-foreground">{org.name}</span>
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {OWNER_LABEL}: <PersonChip person={org.owner} size="sm" />
        </span>
      </p>
      <MeetingForm
        mode="create"
        kind={kind}
        orgId={org.id}
        people={active}
        defaults={defaults}
        orgNextStep={{ step: org.nextStep, date: org.nextStepDate }}
        nowMs={now.getTime()}
        cancelHref={orgHref(kind, org.id)}
      />
    </div>
  )
}

function ArchivedNotice({
  kind,
  orgId,
  orgName,
}: {
  kind: OrgKind
  orgId: string
  orgName: string
}) {
  const noun = kindConfig(kind).singular.toLowerCase()
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-xl border bg-muted/50 p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium">{orgName} is archived.</span> Restore this {noun} from its
          page to log or edit its meetings.
        </span>
      </p>
      <Button asChild className="max-md:w-full">
        <Link href={orgHref(kind, orgId)}>Open {orgName}</Link>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen 2 and the meeting page: /investors/<id>/meetings/<meetingId>
// ---------------------------------------------------------------------------

export function MeetingPageView({
  kind,
  params,
  searchParams,
}: {
  kind: OrgKind
  params: MeetingRouteParams
  searchParams: SearchParams
}) {
  return (
    <div className="max-w-3xl">
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <Suspense fallback={<MeetingPageSkeleton />}>
        <MeetingPageBody kind={kind} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

/**
 * With ?logged=1 (right after logging): "Meeting logged" with the debrief
 * form and the one-click follow-up task. Otherwise: the details, the debrief,
 * tasks from the meeting, and Edit (collapsed). Unknown ids, and a meeting of
 * another org or kind, are this route's 404.
 */
async function MeetingPageBody({
  kind,
  params,
  searchParams,
}: {
  kind: OrgKind
  params: MeetingRouteParams
  searchParams: SearchParams
}) {
  const [{ id, meetingId }, query] = await Promise.all([params, searchParams, requireTeamMember()])
  if (!isRecordId(id) || !isRecordId(meetingId)) notFound()
  const meeting = await getMeeting(kind, id, meetingId)
  if (!meeting) notFound()

  const now = new Date()
  const [debrief, tasks, active, metAgain] = await Promise.all([
    getOrgMeetingDebrief(meeting.id),
    getMeetingTasks(meeting.id),
    getMeetingPeople(),
    metSince(meeting.org.id, meeting.startsAt, now),
  ])
  const today = requestToday()
  const happened = new Date(meeting.startsAt).getTime() <= now.getTime()
  const logged = query.logged === "1"
  const { org } = meeting
  const archived = org.archivedAt !== null

  const followUpTask = followUpTaskOf(tasks)
  const followUp = archived ? null : (
    <FollowUpTaskButton
      meetingId={meeting.id}
      existing={followUpTask ? { id: followUpTask.id, done: followUpTask.status === "done" } : null}
      preview={followUpPreview(meeting, active)}
    />
  )

  const debriefSection = debrief ? (
    <DebriefPanel debrief={debrief} people={active} today={today} />
  ) : (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
      {happened
        ? "The debrief opens in a few minutes, for the point of contact to facilitate."
        : `The debrief opens after the meeting (${formatDateTime(meeting.startsAt)}), for ${firstNameOf(org.owner.name)} to facilitate.`}
    </p>
  )

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <BackLink href={orgHref(kind, org.id)}>{org.name}</BackLink>
        <PageHeader
          className="mb-0 md:mb-0"
          title={`Meeting with ${org.name}`}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <time dateTime={meeting.startsAt}>{formatDateTime(meeting.startsAt)}</time>
              {happened ? null : <Badge variant="outline">Scheduled</Badge>}
            </span>
          }
        />
      </div>

      {logged ? (
        <section
          aria-labelledby="meeting-logged"
          className="space-y-5 rounded-xl border border-primary/40 bg-primary/5 p-4 md:p-5"
        >
          <FocusHeading
            id="meeting-logged"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight outline-none"
          >
            <CircleCheck aria-hidden className="size-5 text-primary" />
            Meeting logged
          </FocusHeading>
          <div className="space-y-3">
            <h3 className="text-base font-semibold">1. Debrief while it&apos;s fresh</h3>
            {debriefSection}
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-semibold">2. Follow-up task</h3>
            {followUp ?? (
              <p className="text-sm text-muted-foreground">
                Restore this {kindConfig(kind).singular.toLowerCase()} to add tasks.
              </p>
            )}
          </div>
          {/* A long name truncates instead of widening the page (buttons don't wrap). */}
          <Button asChild variant="outline" className="max-w-full max-md:w-full">
            <Link href={orgHref(kind, org.id)}>
              <span className="min-w-0 truncate">Back to {org.name}</span>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </section>
      ) : null}

      <SectionCard id="meeting-details" title="Meeting details">
        <MeetingDetails
          meeting={meeting}
          happened={happened}
          followUpSettled={followUpTask?.status === "done" || metAgain}
          today={today}
        />
      </SectionCard>

      {logged ? null : (
        <SectionCard id="meeting-debrief" title="Debrief">
          {debriefSection}
        </SectionCard>
      )}

      <SectionCard id="meeting-tasks" title="Tasks from this meeting">
        <MeetingTaskList
          tasks={tasks}
          today={today}
          followUp={followUpTask || logged ? null : followUp}
          addHref={
            archived
              ? null
              : newTaskHref({
                  org: org.id,
                  orgMeeting: meeting.id,
                  owner: meeting.followUpOwner?.id ?? org.owner.id,
                  due: meeting.followUpDate ?? undefined,
                  returnTo: meetingHref(kind, org.id, meeting.id),
                })
          }
        />
      </SectionCard>

      {archived ? (
        <ArchivedNotice kind={kind} orgId={org.id} orgName={org.name} />
      ) : (
        <EditMeeting kind={kind} meeting={meeting} active={active} now={now} />
      )}
    </div>
  )
}

/** "Creates "Follow up with Acme" for Sam, due Fri, Oct 16." */
function followUpPreview(meeting: MeetingDetail, people: readonly MeetingPerson[]): string {
  const draft = followUpTaskDraft({
    org: {
      id: meeting.org.id,
      name: meeting.org.name,
      ownerId: meeting.org.owner.id,
      nextStep: meeting.org.nextStep,
      nextStepDate: meeting.org.nextStepDate,
    },
    meeting: {
      id: meeting.id,
      startsAt: meeting.startsAt,
      followUpOwnerId: meeting.followUpOwner?.id ?? null,
      followUpDate: meeting.followUpDate,
      materialsRequested: meeting.materialsRequested,
      concernsRaised: meeting.concernsRaised,
    },
  })
  const owner =
    [meeting.followUpOwner, meeting.org.owner, ...people].find((p) => p?.id === draft.owner_id)
      ?.name ?? "the point of contact"
  return `Creates “${draft.title}” for ${firstNameOf(owner)}, due ${formatDate(draft.due_date)}: ${draft.next_action}`
}

/** Edit, collapsed by default: the same form as logging, in edit mode. */
function EditMeeting({
  kind,
  meeting,
  active,
  now,
}: {
  kind: OrgKind
  meeting: MeetingDetail
  active: readonly MeetingPerson[]
  now: Date
}) {
  const defaults: MeetingFormDefaults = {
    meeting_date: toEtDate(meeting.startsAt),
    meeting_time: etTimeOf(meeting.startsAt),
    attendee_ids: meeting.attendees.map((p) => p.id).join(","),
    external_attendees: meeting.externalAttendees ?? "",
    rating: meeting.rating === null ? "" : String(meeting.rating),
    summary: meeting.summary ?? "",
    notes: meeting.notes ?? "",
    concerns_raised: meeting.concernsRaised ?? "",
    materials_requested: meeting.materialsRequested ?? "",
    follow_up_owner_id: meeting.followUpOwner?.id ?? "",
    follow_up_date: meeting.followUpDate ?? "",
    next_step: meeting.org.nextStep,
    next_step_date: meeting.org.nextStepDate,
  }
  const people = attendeeChoices(active, [
    ...meeting.attendees,
    ...(meeting.followUpOwner ? [meeting.followUpOwner] : []),
  ])
  return (
    <details className="group rounded-xl border bg-card shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-5 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        Edit meeting
      </summary>
      <div className="border-t p-4 md:p-5">
        <MeetingForm
          mode="edit"
          kind={kind}
          orgId={meeting.org.id}
          meetingId={meeting.id}
          people={people}
          defaults={defaults}
          orgNextStep={{ step: meeting.org.nextStep, date: meeting.org.nextStepDate }}
          nowMs={now.getTime()}
        />
      </div>
    </details>
  )
}

function MeetingPageSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading the meeting…</span>
      <div aria-hidden className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="mb-4 h-5 w-32" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  )
}
