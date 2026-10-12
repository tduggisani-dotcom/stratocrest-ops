import type { Metadata } from "next"
import { NewOrgPage } from "@/features/orgs/form/org-form-pages"
import { kindConfig } from "@/features/orgs/kind-config"

export const metadata: Metadata = { title: kindConfig("investor").addLabel }

/** Add an investor (features/orgs). */
export default function NewInvestorPage() {
  return <NewOrgPage kind="investor" />
}
