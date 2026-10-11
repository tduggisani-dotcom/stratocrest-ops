import { Suspense } from "react"
import type { Metadata } from "next"
import { LiveRefresh } from "@/components/common/live-refresh"
import { BackToTasks, TaskPageSkeleton } from "@/features/tasks/skeletons"
import { TaskDetailView } from "@/features/tasks/task-detail"

export const metadata: Metadata = { title: "Task" }

/** One task: details, links, history, edit and archive. Unknown or malformed ids are a 404. */
export default function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  return (
    <div className="max-w-3xl">
      <LiveRefresh tables={["tasks"]} />
      <BackToTasks />
      <Suspense fallback={<TaskPageSkeleton />}>
        <TaskDetailView params={params} />
      </Suspense>
    </div>
  )
}
