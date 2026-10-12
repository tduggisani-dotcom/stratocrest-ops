import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/settings").label }

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      href="/settings"
      emptyTitle="Nothing to set up yet"
      emptyDescription="API keys for the Grok bot, webhooks and their delivery log, the Google Sheets and Calendar mirror, and the full activity log. Settings arrive in Stage 6."
      actionLabel="Create a bot API key"
    />
  )
}
