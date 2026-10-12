import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ViewSwitcher } from "./view-switcher"

/** "‹ Tasks" above a task page or the new-task form. Static, so it's part of the instant shell. */
export function BackToTasks() {
  return (
    <Button asChild variant="ghost" className="mb-2 -ml-3 text-muted-foreground">
      <Link href="/tasks">
        <ChevronLeft aria-hidden />
        Tasks
      </Link>
    </Button>
  )
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 p-3 md:p-4">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="hidden h-9 w-40 md:block" />
    </div>
  )
}

/** /tasks while the session and tasks load: the views (none selected yet) and a few rows. */
export function TaskListSkeleton() {
  return (
    <div className="space-y-6">
      <ViewSwitcher current={null} />
      <div role="status" className="space-y-3">
        <span className="sr-only">Loading tasks…</span>
        <Skeleton aria-hidden className="h-5 w-40" />
        <div aria-hidden className="divide-y rounded-xl border bg-card">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </div>
  )
}

function FieldSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={tall ? "h-16 w-full" : "h-11 w-full md:h-9"} />
    </div>
  )
}

export function TaskFormSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading the form…</span>
      <div aria-hidden className="space-y-6">
        <FieldSkeleton />
        <FieldSkeleton tall />
        <div className="grid gap-6 md:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <FieldSkeleton />
        <FieldSkeleton tall />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full md:h-9 md:w-28" />
      </div>
    </div>
  )
}

export function TaskPageSkeleton() {
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">Loading the task…</span>
      <div aria-hidden className="space-y-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-2/3" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
