import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/meetings").label }

export default function MeetingsPage() {
  return (
    <SectionPlaceholder
      href="/meetings"
      emptyTitle="No Sunday meetings yet"
      emptyDescription="Each Sunday meeting gets a rotating facilitator, written updates posted beforehand, an agenda built from decisions needed, and a searchable decision log. Meetings arrive in Stage 4."
      actionLabel="Post your pre-meeting update"
    />
  )
}
