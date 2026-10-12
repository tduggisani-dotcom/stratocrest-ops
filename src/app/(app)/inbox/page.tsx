import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/inbox").label }

export default function InboxPage() {
  return (
    <SectionPlaceholder
      href="/inbox"
      emptyTitle="Nothing to confirm"
      emptyDescription="Notes the Grok bot captures land here as drafts. A person confirms each one before it becomes a real investor, customer, or task. The bot inbox arrives in Stage 6."
      actionLabel="Connect the Grok bot"
    />
  )
}
