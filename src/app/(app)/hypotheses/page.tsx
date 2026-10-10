import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/hypotheses").label }

export default function HypothesesPage() {
  return (
    <SectionPlaceholder
      href="/hypotheses"
      emptyTitle="No hypotheses yet"
      emptyDescription="Every investor and customer conversation tests something we believe. This page rolls them all up as untested, validated, or invalidated, with what we learned. It arrives in Stage 3."
      actionLabel="Add your first hypothesis"
    />
  )
}
