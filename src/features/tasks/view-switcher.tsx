import Link from "next/link"
import { cn } from "@/lib/utils"
import { tasksViewHref } from "./links"
import { TASK_VIEWS, taskViewLabels, type TaskView } from "./views"

/**
 * My tasks · By owner · By status · Due this week, as links (each view has its
 * own URL, so it can be shared and survives a refresh). 44 px tall on phones,
 * where the four labels don't fit in one row (390 px), so they sit in a 2 × 2
 * grid: every view stays visible instead of one hiding off the edge.
 */
export function ViewSwitcher({ current }: { current: TaskView | null }) {
  return (
    <nav aria-label="Task views">
      <ul className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:flex sm:w-fit">
        {TASK_VIEWS.map((view) => {
          const active = view === current
          return (
            <li key={view}>
              <Link
                href={tasksViewHref(view)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none md:h-8",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {taskViewLabels[view]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
