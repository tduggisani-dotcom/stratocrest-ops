import type { Metadata } from "next"
import { EditOrgPage, editOrgTitle } from "@/features/orgs/form/org-form-pages"

export const metadata: Metadata = { title: editOrgTitle("customer") }

/** Edit a customer (features/orgs). */
export default function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  return <EditOrgPage kind="customer" params={params} />
}
