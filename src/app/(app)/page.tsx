import { Suspense } from "react"
import type { Metadata } from "next"
import {
  CalendarDays,
  ChartNoAxesColumn,
  CircleAlert,
  ListChecks,
  Users,
  type LucideIcon,
} from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { firstNameOf } from "@/components/common/person-chip"
import { navItem } from "@/components/shell/nav-config"
import { PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { requireTeamMember } from "@/lib/auth"
import { formatDate, todayEt } from "@/lib/dates"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: navItem("/").label }

type Panel = {
  title: string
  description: string
  icon: LucideIcon
  wide?: boolean
}

// People first: your own work and what needs attention come before program status.
const PANELS: Panel[] = [
  {
    title: "My work",
    description:
      "Your open tasks, follow-ups, and debriefs due, soonest first. Arrives with Tasks in Stage 2.",
    icon: ListChecks,
  },
  {
    title: "Needs attention",
    description:
      "Overdue tasks and follow-ups, investors and customers with no contact in 14+ days, debriefs due, and open help requests. Arrives in Stage 2.",
    icon: CircleAlert,
  },
  {
    title: "Next Synthe6 session",
    description:
      "The date, format, and topic of the next session, with a countdown. Arrives with the program timeline in Stage 4.",
    icon: CalendarDays,
  },
  {
    title: "Next Sunday meeting",
    description:
      "Who's facilitating, and who has and hasn't posted their pre-meeting update. Arrives in Stage 4.",
    icon: Users,
  },
  {
    title: "OKR progress",
    description:
      "Progress bars for this quarter's key results, ahead of the next Synthe6 share-out. Arrives in Stage 5.",
    icon: ChartNoAxesColumn,
    wide: true,
  },
]

export default function ThisWeekPage() {
  return (
    <Suspense fallback={<ThisWeekSkeleton />}>
      <ThisWeek />
    </Suspense>
  )
}

async function ThisWeek() {
  const person = await requireTeamMember()
  const today = todayEt()

  return (
    <>
      <PageHeader
        title={`Hi, ${firstNameOf(person.name)}`}
        description={`${formatDate(today, "long")}. Here's your week at a glance.`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {PANELS.map((panel) => (
          <EmptyState
            key={panel.title}
            size="compact"
            icon={panel.icon}
            title={panel.title}
            description={panel.description}
            className={cn("bg-card", panel.wide && "md:col-span-2")}
          />
        ))}
      </div>
    </>
  )
}

function ThisWeekSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your week…</span>
      <div className="mb-6 space-y-2 md:mb-8" aria-hidden>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2" aria-hidden>
        {PANELS.map((panel) => (
          <div
            key={panel.title}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6",
              panel.wide && "md:col-span-2",
            )}
          >
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full max-w-xs" />
            <Skeleton className="h-3 w-2/3 max-w-60" />
          </div>
        ))}
      </div>
    </div>
  )
}
