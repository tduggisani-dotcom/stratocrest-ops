import type { Metadata } from "next"
import { MeetingPageView } from "@/features/orgs/meetings/meeting-pages"

export const metadata: Metadata = { title: "Meeting" }

/** One investor meeting: details, debrief, tasks and edit; with ?logged=1, screen 2 of logging it. */
export default function InvestorMeetingPage({
  params,
  searchParams,
}: PageProps<"/investors/[id]/meetings/[meetingId]">) {
  return <MeetingPageView kind="investor" params={params} searchParams={searchParams} />
}
