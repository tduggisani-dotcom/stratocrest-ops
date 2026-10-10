import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/customers").label }

export default function CustomersPage() {
  return (
    <SectionPlaceholder
      href="/customers"
      emptyTitle="No customers yet"
      emptyDescription="Construction firms, hard hat manufacturers, and safety distributors, tracked from first contact through pilot to conversion, each with an owner, a next step, and a date. The customer pipeline arrives in Stage 3."
      actionLabel="Add your first customer"
    />
  )
}
