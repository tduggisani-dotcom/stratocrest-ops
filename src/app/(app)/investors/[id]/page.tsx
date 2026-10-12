import type { Metadata } from "next"
import { OrgPageView } from "@/features/orgs/detail/org-page"
import { kindConfig } from "@/features/orgs/kind-config"

export const metadata: Metadata = { title: kindConfig("investor").singular }

/** One investor: details, meetings, hypotheses, tasks, debriefs and history (features/orgs). */
export default function InvestorPage({ params }: PageProps<"/investors/[id]">) {
  return <OrgPageView kind="investor" params={params} />
}
