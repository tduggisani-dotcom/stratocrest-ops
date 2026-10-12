import type { Route } from "next"
import {
  CalendarDays,
  ClipboardCheck,
  Contact,
  FlaskConical,
  HardHat,
  House,
  Inbox,
  Landmark,
  ListChecks,
  MessageSquareText,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * Every section of the signed-in app, in sidebar order. The single source for
 * the desktop sidebar, the mobile bottom nav and its "More" sheet, and page
 * headers.
 *
 * - `group`: "primary" sections sit at the top of the sidebar, "secondary" ones
 *   under a "More" heading.
 * - `mobileTab`: shown as a tab in the phone bottom nav (the rest go in "More").
 * - `stage`: the build stage that delivers the section (placeholder pages say so).
 */
export type NavItem = {
  href: Route
  label: string
  /** Shorter label for the phone bottom nav. */
  shortLabel?: string
  /** One line for the page header. */
  description: string
  icon: LucideIcon
  group: "primary" | "secondary"
  mobileTab: boolean
  stage: number
}

export const NAV_ITEMS = [
  {
    href: "/",
    label: "This Week",
    description: "What you need to do this week, and what needs the team's attention.",
    icon: House,
    group: "primary",
    mobileTab: true,
    stage: 2,
  },
  {
    href: "/investors",
    label: "Investors",
    description: "Every investor conversation: who owns it, what's next, and how it went.",
    icon: Landmark,
    group: "primary",
    mobileTab: true,
    stage: 3,
  },
  {
    href: "/customers",
    label: "Customers",
    description: "The customer and pilot pipeline, from first contact to conversion.",
    icon: HardHat,
    group: "primary",
    mobileTab: true,
    stage: 3,
  },
  {
    href: "/tasks",
    label: "Tasks",
    description: "Every task has one owner, a concrete next action, and a due date.",
    icon: ListChecks,
    group: "primary",
    mobileTab: true,
    stage: 2,
  },
  {
    href: "/program",
    label: "Synthe6 Program",
    shortLabel: "Program",
    description: "The Synthe6 cohort 2 schedule, with prep and debriefs for each session.",
    icon: CalendarDays,
    group: "primary",
    mobileTab: false,
    stage: 4,
  },
  {
    href: "/meetings",
    label: "Sunday Meetings",
    shortLabel: "Meetings",
    description: "Pre-meeting updates, the agenda, decisions, and action items.",
    icon: Users,
    group: "primary",
    mobileTab: false,
    stage: 4,
  },
  {
    href: "/debriefs",
    label: "Debriefs",
    description: "What was planned, what happened, what worked, and what we'll change.",
    icon: MessageSquareText,
    group: "primary",
    mobileTab: false,
    stage: 4,
  },
  {
    href: "/okrs",
    label: "OKRs",
    description: "Quarterly objectives and key results, tied to the Synthe6 share-outs.",
    icon: Target,
    group: "primary",
    mobileTab: false,
    stage: 5,
  },
  {
    href: "/people",
    label: "People",
    description: "Who owns what, who's available, and who to ask for help.",
    icon: Contact,
    group: "primary",
    mobileTab: false,
    stage: 2,
  },
  {
    href: "/hypotheses",
    label: "Hypotheses",
    description: "What we believe, how we're testing it, and what we learned.",
    icon: FlaskConical,
    group: "secondary",
    mobileTab: false,
    stage: 3,
  },
  {
    href: "/checklists",
    label: "Checklists",
    description: "Reusable checklists for high-stakes events, ticked off item by item.",
    icon: ClipboardCheck,
    group: "secondary",
    mobileTab: false,
    stage: 5,
  },
  {
    href: "/inbox",
    label: "Bot inbox",
    shortLabel: "Inbox",
    description: "Notes the Grok bot captured, waiting for a person to confirm them.",
    icon: Inbox,
    group: "secondary",
    mobileTab: false,
    stage: 6,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Bot API keys, webhooks, integrations, and the activity log.",
    icon: Settings,
    group: "secondary",
    mobileTab: false,
    stage: 6,
  },
] as const satisfies readonly NavItem[]

export type NavHref = (typeof NAV_ITEMS)[number]["href"]

export const PRIMARY_NAV: readonly NavItem[] = NAV_ITEMS.filter((i) => i.group === "primary")
export const SECONDARY_NAV: readonly NavItem[] = NAV_ITEMS.filter((i) => i.group === "secondary")
export const MOBILE_TABS: readonly NavItem[] = NAV_ITEMS.filter((i) => i.mobileTab)
/** Everything that isn't a bottom-nav tab, in sidebar order. */
export const MOBILE_MORE: readonly NavItem[] = NAV_ITEMS.filter((i) => !i.mobileTab)

/** The nav entry for a section, e.g. for its page header. */
export function navItem(href: NavHref): NavItem {
  const item = NAV_ITEMS.find((i) => i.href === href)
  if (!item) throw new Error(`No nav item for ${href}`)
  return item
}

/** True when `pathname` is the section at `href` or a page inside it. */
export function isActivePath(href: string, pathname: string | null): boolean {
  if (!pathname) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
