import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/investors").label }

export default function InvestorsPage() {
  return (
    <SectionPlaceholder
      href="/investors"
      emptyTitle="No investors yet"
      emptyDescription="Each investor gets one owner, a concrete next step, and a date, plus a log of every meeting: how it went, what they asked for, and what we learned. The investor tracker arrives in Stage 3."
      actionLabel="Add your first investor"
    />
  )
}
