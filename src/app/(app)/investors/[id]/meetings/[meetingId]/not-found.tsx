import { MeetingNotFound } from "@/features/orgs/meetings/not-found"

/** /investors/<id>/meetings/<unknown or mismatched meeting id>. */
export default function InvestorMeetingNotFound() {
  return <MeetingNotFound kind="investor" />
}
