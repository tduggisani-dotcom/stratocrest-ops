import type { Metadata } from "next"
import { NewOrgPage } from "@/features/orgs/form/org-form-pages"
import { kindConfig } from "@/features/orgs/kind-config"

export const metadata: Metadata = { title: kindConfig("customer").addLabel }

/** Add a customer (features/orgs). */
export default function NewCustomerPage() {
  return <NewOrgPage kind="customer" />
}
