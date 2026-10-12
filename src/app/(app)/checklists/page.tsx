import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/checklists").label }

export default function ChecklistsPage() {
  return (
    <SectionPlaceholder
      href="/checklists"
      emptyTitle="No checklists yet"
      emptyDescription="Starter templates for investor meeting prep, grant submissions, mentor sessions, and Demo Day rehearsals, attached to sessions, organizations, or tasks and ticked off item by item. Checklists arrive in Stage 5."
      actionLabel="Start your first checklist"
    />
  )
}
