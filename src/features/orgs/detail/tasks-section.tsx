import Link from "next/link"
import { CircleCheck, ListTodo, Plus } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { newTaskHref, taskHref } from "@/features/tasks/links"
import { ItemRow, SectionCard, SubList } from "@/features/this-week/components/section-card"
import { formatDate, toEtDate } from "@/lib/dates"
import { taskStatusLabels } from "@/lib/labels"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgHref } from "../links"
import { getOrgTasks } from "../queries/detail"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "./resolve"
import { ORG_SECTIONS } from "./sections"

/**
 * Tasks linked to this org or one of its meetings: open ones first (soonest
 * due, each with its owner and status), then the latest done ones. "Add task"
 * prefills the org and its owner and comes back here.
 */
export async function OrgTasksSection({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const id = await orgIdFrom(params)
  const [org, tasks] = await Promise.all([orgOrNotFound(kind, id), getOrgTasks(id)])
  const today = requestToday()
  const { id: sectionId, title } = ORG_SECTIONS.tasks
  const noun = kindConfig(kind).singular.toLowerCase()
  const archived = org.archivedAt !== null
  const addHref = newTaskHref({
    org: org.id,
    owner: org.owner.isActive ? org.owner.id : undefined,
    returnTo: orgHref(kind, org.id),
  })
  const addButton = (label: string) =>
    archived ? null : (
      <Button asChild variant="outline" className="max-md:w-full">
        <Link href={addHref}>
          <Plus aria-hidden />
          {label}
        </Link>
      </Button>
    )

  if (tasks.open.length === 0 && tasks.doneTotal === 0) {
    return (
      <SectionCard id={sectionId} title={title}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={ListTodo}
          title={`No tasks for this ${noun} yet`}
          description={`Tasks linked to ${org.name} or one of its meetings show here, with who owns each one and when it's due.`}
          action={addButton("Add a task")}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      id={sectionId}
      title={title}
      count={tasks.open.length > 0 ? { value: tasks.open.length, label: "open" } : undefined}
      action={addButton("Add task")}
    >
      <SubList
        id="org-tasks-open"
        title="Open"
        count={tasks.open.length}
        countLabel="open"
        empty={`Nothing open. Every task for this ${noun} is done.`}
      >
        {tasks.open.map((task) => (
          <ItemRow
            key={task.id}
            href={taskHref(task.id)}
            title={task.title}
            detail={
              <>
                <span className="sr-only">Next action: </span>
                {task.nextAction}
              </>
            }
          >
            <PersonChip person={task.owner} size="sm" />
            <DueDate date={task.dueDate} today={today} />
            {task.status !== "to_do" ? (
              <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
            ) : null}
          </ItemRow>
        ))}
      </SubList>
      {tasks.doneTotal > 0 ? (
        <SubList
          id="org-tasks-done"
          title="Recently done"
          count={tasks.done.length}
          countLabel="done"
          hidden={tasks.doneTotal - tasks.done.length}
        >
          {tasks.done.map((task) => (
            <ItemRow key={task.id} href={taskHref(task.id)} title={task.title}>
              <PersonChip person={task.owner} size="sm" />
              <span className="inline-flex items-center gap-1 text-good">
                <CircleCheck aria-hidden className="size-3.5" />
                Done
                {task.completedAt ? ` ${formatDate(toEtDate(task.completedAt), "short")}` : ""}
              </span>
            </ItemRow>
          ))}
        </SubList>
      ) : null}
    </SectionCard>
  )
}
