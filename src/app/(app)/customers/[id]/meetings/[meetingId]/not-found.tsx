import { MeetingNotFound } from "@/features/orgs/meetings/not-found"

/** /customers/<id>/meetings/<unknown or mismatched meeting id>. */
export default function CustomerMeetingNotFound() {
  return <MeetingNotFound kind="customer" />
}
