import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { OrgListPage } from "@/features/orgs/list/org-list-page"

export const metadata: Metadata = { title: navItem("/investors").label }

/** The investor tracker (spec §6.2); the same page as /customers, configured by kind. */
export default function InvestorsPage({ searchParams }: PageProps<"/investors">) {
  return <OrgListPage kind="investor" searchParams={searchParams} />
}
