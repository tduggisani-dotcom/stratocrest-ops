import type { Metadata } from "next"
import { EditOrgPage, editOrgTitle } from "@/features/orgs/form/org-form-pages"

export const metadata: Metadata = { title: editOrgTitle("investor") }

/** Edit an investor (features/orgs). */
export default function EditInvestorPage({ params }: PageProps<"/investors/[id]/edit">) {
  return <EditOrgPage kind="investor" params={params} />
}
