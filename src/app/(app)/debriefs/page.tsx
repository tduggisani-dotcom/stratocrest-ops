import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/debriefs").label }

export default function DebriefsPage() {
  return (
    <SectionPlaceholder
      href="/debriefs"
      emptyTitle="No debriefs yet"
      emptyDescription="After each Synthe6 session, investor or customer meeting, and Sunday meeting: what was planned, what happened, what worked, and what we'll change. Debriefs arrive in Stage 4."
      actionLabel="Start your first debrief"
    />
  )
}
