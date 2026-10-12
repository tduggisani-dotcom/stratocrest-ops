import type { Metadata } from "next"
import { MeetingPageView } from "@/features/orgs/meetings/meeting-pages"

export const metadata: Metadata = { title: "Meeting" }

/** One customer meeting: details, debrief, tasks and edit; with ?logged=1, screen 2 of logging it. */
export default function CustomerMeetingPage({
  params,
  searchParams,
}: PageProps<"/customers/[id]/meetings/[meetingId]">) {
  return <MeetingPageView kind="customer" params={params} searchParams={searchParams} />
}
