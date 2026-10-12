import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/program").label }

export default function ProgramPage() {
  return (
    <SectionPlaceholder
      href="/program"
      emptyTitle="The Synthe6 timeline isn't here yet"
      emptyDescription="Every week of the cohort 2 schedule, with the next session highlighted, break weeks greyed out, and a prep checklist and debrief for each session. The timeline arrives in Stage 4."
      actionLabel="Prep the next session"
    />
  )
}
