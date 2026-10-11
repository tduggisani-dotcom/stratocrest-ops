import { Suspense } from "react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/shell/page-header"
import { NewTaskForm } from "@/features/tasks/new-task"
import { BackToTasks, TaskFormSkeleton } from "@/features/tasks/skeletons"

export const metadata: Metadata = { title: "Add task" }

/** New task. Any section can link here with prefills (newTaskHref in src/features/tasks/links.ts). */
export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <div className="max-w-2xl">
      <BackToTasks />
      <PageHeader title="Add a task" description="One owner, the very next step, and a due date." />
      <Suspense fallback={<TaskFormSkeleton />}>
        <NewTaskForm searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
