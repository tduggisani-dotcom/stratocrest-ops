import type { Metadata } from "next"
import { NewMeetingPage } from "@/features/orgs/meetings/meeting-pages"

export const metadata: Metadata = { title: "Log a meeting" }

/** Screen 1 of logging a meeting with a customer (features/orgs/meetings). */
export default function NewCustomerMeetingPage({
  params,
}: PageProps<"/customers/[id]/meetings/new">) {
  return <NewMeetingPage kind="customer" params={params} />
}
