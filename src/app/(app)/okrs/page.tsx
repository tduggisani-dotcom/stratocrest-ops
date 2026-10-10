import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/okrs").label }

export default function OkrsPage() {
  return (
    <SectionPlaceholder
      href="/okrs"
      emptyTitle="No OKRs yet"
      emptyDescription="Objectives for each Synthe6 quarter with two to four measurable key results, progress bars, and a one-page share-out view. OKRs arrive in Stage 5."
      actionLabel="Set your first objective"
    />
  )
}
