import Link from "next/link"
import { ChevronRight, ListChecks, Plus } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import { requireTeamMember } from "@/lib/auth"
import { crunchPeriodsCovering, type CrunchPeriod } from "@/lib/crunch"
import { getActivePeople } from "@/lib/data/people"
import { formatDate, todayEt, type IsoDate } from "@/lib/dates"
import { taskStatusLabels } from "@/lib/labels"
import { newTaskHref, tasksViewHref } from "./links"
import { getCrunchPeriods, listTasks, type TaskListItem, type TaskOwner } from "./queries"
import { TaskRow, type RowCrunch } from "./task-row"
import { ViewSwitcher } from "./view-switcher"
import {
  DONE_WINDOW_DAYS,
  isOpen,
  mineView,
  ownerView,
  parseTaskView,
  statusView,
  weekView,
  type TaskView,
} from "./views"

/**
 * The /tasks body: the view switcher and the chosen view. Reads the session,
 * the URL and the database, so the page renders it inside <Suspense>.
 */
export async function TaskViews({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const person = await requireTeamMember()
  const today = todayEt()
  const [params, tasks, people, crunchPeriods] = await Promise.all([
    searchParams,
    listTasks(today),
    getActivePeople(),
    getCrunchPeriods(),
  ])
  const view = parseTaskView(params.view)
  const list = { today, crunchPeriods }

  return (
    // data-task-views: where a status change looks for the row it moved (status-focus.ts).
    <div data-task-views className="space-y-6">
      <ViewSwitcher current={view} />
      {tasks.length === 0 ? (
        <NoTasks view={view} />
      ) : view === "mine" ? (
        <MineView tasks={tasks} personId={person.id} {...list} />
      ) : view === "owner" ? (
        <OwnerView tasks={tasks} people={people} {...list} />
      ) : view === "status" ? (
        <StatusView tasks={tasks} {...list} />
      ) : (
        <WeekView tasks={tasks} {...list} />
      )}
    </div>
  )
}

type ListContext = { today: IsoDate; crunchPeriods: CrunchPeriod[] }

/** A list of task rows, each with its crunch marker worked out here on the server. */
export function TaskList({
  tasks,
  today,
  crunchPeriods,
  label,
  showOwner = true,
  compact = false,
}: ListContext & {
  tasks: readonly TaskListItem[]
  label: string
  showOwner?: boolean
  compact?: boolean
}) {
  return (
    <ul aria-label={label} className="divide-y overflow-hidden rounded-xl border bg-card">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          crunch={crunchFor(task, crunchPeriods)}
          showOwner={showOwner}
          compact={compact}
        />
      ))}
    </ul>
  )
}

function crunchFor(task: TaskListItem, periods: readonly CrunchPeriod[]): RowCrunch | null {
  if (!isOpen(task)) return null
  const period = crunchPeriodsCovering(periods, task.ownerId, task.dueDate)[0]
  return period ? { label: period.label } : null
}

function AddTaskButton({
  returnTo,
  owner,
  label = "Add a task",
  variant = "default",
}: {
  returnTo: string
  owner?: string
  label?: string
  variant?: "default" | "ghost"
}) {
  return (
    <Button asChild variant={variant} className={variant === "default" ? "max-md:w-full" : ""}>
      <Link href={newTaskHref({ owner, returnTo })}>
        <Plus aria-hidden />
        {label}
      </Link>
    </Button>
  )
}

/** Focusable from script: focus lands here when a status change empties the list below. */
function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2
      id={id}
      tabIndex={-1}
      className="flex items-baseline gap-2 text-base font-semibold focus-visible:outline-offset-4"
    >
      {title}
      <span className="text-sm font-normal text-muted-foreground">{count}</span>
    </h2>
  )
}

/** Before the team has any tasks at all. */
function NoTasks({ view }: { view: TaskView }) {
  return (
    <EmptyState
      icon={ListChecks}
      title="No tasks yet"
      description="Every task has one owner, a concrete next action, and a due date. Add the first one and it shows up here, in your list and on the owner's."
      action={<AddTaskButton returnTo={tasksViewHref(view)} label="Add the first task" />}
    />
  )
}

function MineView({
  tasks,
  personId,
  ...list
}: ListContext & { tasks: TaskListItem[]; personId: string }) {
  const { open, done } = mineView(tasks, personId, list.today)
  return (
    <>
      <section aria-labelledby="tasks-mine-open" className="space-y-3">
        <SectionHeading id="tasks-mine-open" title="Your open tasks" count={open.length} />
        {open.length > 0 ? (
          <TaskList tasks={open} label="Your open tasks" {...list} />
        ) : (
          <EmptyState
            icon={ListChecks}
            size="compact"
            titleAs="h3"
            title="Nothing on your list"
            description="Tasks you own show up here, soonest due first. Add one when you take on something new, with the very next step and a date."
            action={<AddTaskButton returnTo={tasksViewHref("mine")} />}
          />
        )}
      </section>
      {done.length > 0 ? (
        <DoneDetails
          tasks={done}
          title={`Done in the last ${DONE_WINDOW_DAYS.mine} days`}
          {...list}
        />
      ) : null}
    </>
  )
}

/** Finished tasks, collapsed by default. */
function DoneDetails({
  tasks,
  title,
  ...list
}: ListContext & { tasks: TaskListItem[]; title: string }) {
  return (
    <details className="group space-y-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-9 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 transition-transform group-open:rotate-90" />
        {title}
        <span className="font-normal">({tasks.length})</span>
      </summary>
      <TaskList tasks={tasks} label={title} compact {...list} />
    </details>
  )
}

function OwnerView({
  tasks,
  people,
  ...list
}: ListContext & {
  tasks: TaskListItem[]
  people: Awaited<ReturnType<typeof getActivePeople>>
}) {
  const sections = ownerView(
    tasks,
    people.map((p) => p.id),
  )
  // Owners who left the team still show, with what they own (from the task rows).
  const ownerById = new Map<string, TaskOwner & { role?: string }>(
    tasks.map((t) => [t.ownerId, t.owner]),
  )
  for (const p of people) ownerById.set(p.id, p)

  if (sections.every((section) => section.tasks.length === 0)) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Nobody has anything open"
        description="Each teammate's open tasks show up here under their name, soonest due first, so you can see who's carrying what before you hand out more."
        action={<AddTaskButton returnTo={tasksViewHref("owner")} />}
      />
    )
  }

  return (
    <div className="space-y-8">
      {sections.map(({ ownerId, tasks: owned }) => {
        const owner = ownerById.get(ownerId)
        if (!owner) return null
        const headingId = `tasks-owner-${ownerId}`
        return (
          <section key={ownerId} aria-labelledby={headingId} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2
                id={headingId}
                tabIndex={-1}
                className="flex min-w-0 items-center gap-3 focus-visible:outline-offset-4"
              >
                <PersonChip person={owner} showRole />
                <span className="shrink-0 text-sm font-normal text-muted-foreground">
                  {owned.length} open
                </span>
              </h2>
              <Button asChild variant="ghost" className="shrink-0">
                <Link
                  href={newTaskHref({ owner: ownerId, returnTo: tasksViewHref("owner") })}
                  aria-label={`Add a task for ${owner.name}`}
                >
                  <Plus aria-hidden />
                  Add
                </Link>
              </Button>
            </div>
            {owned.length > 0 ? (
              <TaskList
                tasks={owned}
                label={`${owner.name}'s open tasks`}
                showOwner={false}
                {...list}
              />
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Nothing open.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function StatusView({ tasks, ...list }: ListContext & { tasks: TaskListItem[] }) {
  const sections = statusView(tasks, list.today)
  return (
    <div className="space-y-8">
      {sections.map(({ status, tasks: inStatus }) => {
        const title =
          status === "done"
            ? `${taskStatusLabels.done} in the last ${DONE_WINDOW_DAYS.status} days`
            : taskStatusLabels[status]
        const headingId = `tasks-status-${status}`
        return (
          <section key={status} aria-labelledby={headingId} className="space-y-3">
            <SectionHeading id={headingId} title={title} count={inStatus.length} />
            {inStatus.length > 0 ? (
              <TaskList tasks={inStatus} label={title} compact={status === "done"} {...list} />
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                {status === "done" ? "Nothing finished recently." : "Nothing here."}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function WeekView({ tasks, ...list }: ListContext & { tasks: TaskListItem[] }) {
  const { weekEnd, tasks: due } = weekView(tasks, list.today)
  const until = weekEnd === list.today ? "today" : formatDate(weekEnd, "medium")
  const title = `Due by ${until}`
  return (
    <section aria-labelledby="tasks-week" className="space-y-3">
      <div className="space-y-1">
        <SectionHeading id="tasks-week" title={title} count={due.length} />
        <p className="text-sm text-muted-foreground">
          Everyone&apos;s open tasks due on or before this Sunday, overdue first.
        </p>
      </div>
      {due.length > 0 ? (
        <TaskList tasks={due} label={title} {...list} />
      ) : (
        <EmptyState
          icon={ListChecks}
          size="compact"
          titleAs="h3"
          title="Nothing due this week"
          description="Open tasks due on or before Sunday show up here, overdue first, so the team can see what has to land before the Sunday meeting."
          action={<AddTaskButton returnTo={tasksViewHref("week")} />}
        />
      )}
    </section>
  )
}
