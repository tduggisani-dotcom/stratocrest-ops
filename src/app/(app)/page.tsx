import { Suspense } from "react"
import type { Metadata } from "next"
import { LiveRefresh, type LiveTable } from "@/components/common/live-refresh"
import { firstNameOf } from "@/components/common/person-chip"
import { navItem } from "@/components/shell/nav-config"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { MyWorkSection } from "@/features/this-week/components/my-work"
import { NeedsAttentionSection } from "@/features/this-week/components/needs-attention"
import { NextSessionSection } from "@/features/this-week/components/next-session"
import { OkrProgressSection } from "@/features/this-week/components/okr-progress"
import { OrgMeetingsSection } from "@/features/this-week/components/org-meetings"
import { SectionSlot } from "@/features/this-week/components/section-slot"
import { SundayMeetingSection } from "@/features/this-week/components/sunday-meeting"
import { requestClock } from "@/features/this-week/queries"
import { requireTeamMember } from "@/lib/auth"
import { formatDate } from "@/lib/dates"

export const metadata: Metadata = { title: navItem("/").label }

/** Everything the page shows; a change to any of them (by anyone, or the bot) refreshes it. */
const LIVE_TABLES = [
  "tasks",
  "organizations",
  "org_meetings",
  "org_meeting_attendees",
  "debriefs",
  "help_requests",
  "team_meetings",
  "meeting_updates",
  "objectives",
  "key_results",
  "synthe6_sessions",
  "people",
] as const satisfies readonly LiveTable[]

/**
 * This Week (spec §6.1). People first: "My work" and "Needs attention" come
 * before program status, and on phones "My work" is the first thing on the
 * page. The page itself is a static shell (headings and placeholders show
 * instantly); each card streams in behind its own Suspense boundary and error
 * boundary.
 */
export default function ThisWeekPage() {
  return (
    <>
      <LiveRefresh tables={LIVE_TABLES} />
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <SectionSlot section="myWork" rows={4}>
          <MyWorkSection />
        </SectionSlot>
        <SectionSlot section="needsAttention" rows={4}>
          <NeedsAttentionSection />
        </SectionSlot>
        <SectionSlot section="nextSession">
          <NextSessionSection />
        </SectionSlot>
        <SectionSlot section="sundayMeeting">
          <SundayMeetingSection />
        </SectionSlot>
        <SectionSlot section="orgMeetings" wide rows={2}>
          <OrgMeetingsSection />
        </SectionSlot>
        <SectionSlot section="okrs" wide rows={2}>
          <OkrProgressSection />
        </SectionSlot>
      </div>
    </>
  )
}

async function Greeting() {
  const person = await requireTeamMember()
  const { today } = requestClock()
  return (
    <PageHeader
      title={`Hi, ${firstNameOf(person.name)}`}
      description={`${formatDate(today, "long")}. Here's your week at a glance.`}
    />
  )
}

function GreetingSkeleton() {
  return (
    <div role="status" className="mb-6 md:mb-8">
      <span className="sr-only">Loading your week…</span>
      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    </div>
  )
}
