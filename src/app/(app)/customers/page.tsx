import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { OrgListPage } from "@/features/orgs/list/org-list-page"

export const metadata: Metadata = { title: navItem("/customers").label }

/** The customer and pilot pipeline (spec §6.3); the same page as /investors, configured by kind. */
export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return <OrgListPage kind="customer" searchParams={searchParams} />
}
