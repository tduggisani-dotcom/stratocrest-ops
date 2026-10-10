import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { SectionPlaceholder } from "../_components/section-placeholder"

export const metadata: Metadata = { title: navItem("/tasks").label }

export default function TasksPage() {
  return (
    <SectionPlaceholder
      href="/tasks"
      emptyTitle="No tasks yet"
      emptyDescription="Your tasks, everyone's tasks by owner and status, and what's due this week. Every task has one owner, a concrete next action, and a due date. Tasks arrive in Stage 2."
      actionLabel="Add your first task"
    />
  )
}
