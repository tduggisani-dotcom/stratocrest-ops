import {
  CalendarDays,
  ChartNoAxesColumn,
  CircleAlert,
  Handshake,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * The This Week sections in page order (spec §6.1; people first: my work and
 * what needs attention come before program status). The ids are the cards'
 * anchors; the titles are their h2s (and region names).
 */
export const SECTIONS = {
  myWork: { id: "my-work", title: "My work", icon: ListChecks },
  needsAttention: { id: "needs-attention", title: "Needs attention", icon: CircleAlert },
  nextSession: { id: "next-session", title: "Next Synthe6 session", icon: CalendarDays },
  sundayMeeting: { id: "sunday-meeting", title: "Next Sunday meeting", icon: Users },
  orgMeetings: { id: "org-meetings", title: "Meetings in the next 7 days", icon: Handshake },
  okrs: { id: "okr-progress", title: "OKR progress", icon: ChartNoAxesColumn },
} as const satisfies Record<string, { id: string; title: string; icon: LucideIcon }>

export type SectionKey = keyof typeof SECTIONS
