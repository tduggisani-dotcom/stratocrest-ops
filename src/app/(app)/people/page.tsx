import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/people").label }

export default function PeoplePage() {
  return (
    <SectionPlaceholder
      href="/people"
      emptyTitle="Team profiles aren't here yet"
      emptyDescription="Everyone's role, strengths, skills, availability, and crunch periods, plus who owns what, a workload view, and a wins feed. Profiles arrive in Stage 2."
      actionLabel="Complete your profile"
    />
  )
}
