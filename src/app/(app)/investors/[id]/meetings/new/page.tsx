import type { Metadata } from "next"
import { NewMeetingPage } from "@/features/orgs/meetings/meeting-pages"

export const metadata: Metadata = { title: "Log a meeting" }

/** Screen 1 of logging a meeting with an investor (features/orgs/meetings). */
export default function NewInvestorMeetingPage({
  params,
}: PageProps<"/investors/[id]/meetings/new">) {
  return <NewMeetingPage kind="investor" params={params} />
}
