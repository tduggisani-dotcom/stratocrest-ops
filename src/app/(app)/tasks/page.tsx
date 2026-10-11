import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"
import { LiveRefresh } from "@/components/common/live-refresh"
import { navItem } from "@/components/shell/nav-config"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { TaskListSkeleton } from "@/features/tasks/skeletons"
import { TaskViews } from "@/features/tasks/task-views"

export const metadata: Metadata = { title: navItem("/tasks").label }

/**
 * Tasks (spec §6.4): My tasks, By owner, By status, Due this week (?view=).
 * The header is static (instant); the views stream in behind Suspense and
 * refresh live when anyone, including the bot, changes a task.
 */
export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const section = navItem("/tasks")
  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      <PageHeader
        title={section.label}
        description={section.description}
        actions={
          <Button asChild className="max-md:w-full">
            <Link href="/tasks/new">
              <Plus aria-hidden />
              Add task
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskViews searchParams={searchParams} />
      </Suspense>
    </>
  )
}
