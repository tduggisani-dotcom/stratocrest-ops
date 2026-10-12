import type { Metadata } from "next"
import { OrgPageView } from "@/features/orgs/detail/org-page"
import { kindConfig } from "@/features/orgs/kind-config"

export const metadata: Metadata = { title: kindConfig("customer").singular }

/** One customer: details, meetings, hypotheses, tasks, debriefs and history (features/orgs). */
export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return <OrgPageView kind="customer" params={params} />
}
