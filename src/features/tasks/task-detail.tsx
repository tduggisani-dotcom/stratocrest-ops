import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { Route } from "next"
import {
  Archive,
  Bot,
  Building2,
  CalendarDays,
  ChevronRight,
  Handshake,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { requireTeamMember } from "@/lib/auth"
import { crunchPeriodsCovering, crunchWarning } from "@/lib/crunch"
import { formatDate, formatDateTime, todayEt, type IsoDate } from "@/lib/dates"
import {
  ACTOR_KIND_LABELS,
  orgKindLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from "@/lib/labels"
import { taskIdSchema } from "@/lib/schemas/tasks"
import { ArchiveTaskButton, RestoreTaskButton } from "./archive-buttons"
import { CrunchNote } from "./crunch-note"
import { orgListHref } from "./links"
import { orgMeetingLabel, teamMeetingLabel, withCurrent, type TaskFormOptions } from "./options"
import { getTask, getTaskFormOptions, type TaskActor, type TaskDetail } from "./queries"
import { TaskForm, type TaskFormDefaults } from "./task-form"
import { TaskStatusControl } from "./task-status"
import { isOpen } from "./views"

/**
 * One task: who owns it, the next action, notes, what it links to, who
 * created and last changed it, the edit form, and Archive (or, for an archived
 * task, a banner with Restore). Reads the session, the URL and the database,
 * so the page renders it inside <Suspense>.
 */
export async function TaskDetailView({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireTeamMember()])
  if (!taskIdSchema.safeParse(id).success) notFound()

  const today = todayEt()
  const [task, options] = await Promise.all([getTask(id), getTaskFormOptions(today)])
  if (!task) notFound()

  const archived = task.archivedAt !== null
  const crunch = isOpen(task)
    ? crunchPeriodsCovering(options.crunchPeriods, task.ownerId, task.dueDate).map((period) =>
        crunchWarning(task.owner.name, period, (day) => formatDate(day, "short")),
      )
    : []

  return (
    <article className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
          {task.title}
        </h1>
        {archived ? (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-xl border bg-muted/50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <p className="flex items-start gap-2 text-sm">
              <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">Archived.</span> This task doesn&apos;t appear in any
                list. Restore it to edit it or change its status.
              </span>
            </p>
            <RestoreTaskButton taskId={task.id} />
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 md:grid-cols-[auto_auto_auto_1fr] md:items-end md:gap-x-8">
          <Meta label="Status">
            {archived ? (
              <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
            ) : (
              <TaskStatusControl taskId={task.id} title={task.title} status={task.status} />
            )}
          </Meta>
          <Meta label="Owner">
            <PersonChip person={task.owner} showRole />
          </Meta>
          <Meta label="Due">
            <DueDate date={task.dueDate} today={today} done={task.status === "done"} />
          </Meta>
          <Meta label="Priority">
            <span className="text-sm">{taskPriorityLabels[task.priority]}</span>
          </Meta>
        </dl>

        {crunch.map((warning) => (
          <CrunchNote key={warning}>{warning}</CrunchNote>
        ))}
      </header>

      <section aria-labelledby="task-next-action" className="space-y-1">
        <h2 id="task-next-action" className="text-sm font-medium text-muted-foreground">
          Next action
        </h2>
        <p className="text-lg font-medium text-pretty break-words">{task.nextAction}</p>
      </section>

      {task.notes ? (
        <section aria-labelledby="task-notes" className="space-y-1">
          <h2 id="task-notes" className="text-sm font-medium text-muted-foreground">
            Notes
          </h2>
          <p className="text-sm whitespace-pre-wrap break-words">{task.notes}</p>
        </section>
      ) : null}

      <TaskLinks task={task} today={today} />
      <TaskHistory task={task} />

      {archived ? null : (
        <>
          <section aria-labelledby="task-edit" className="space-y-3">
            <h2 id="task-edit" className="text-base font-semibold">
              Edit task
            </h2>
            <div className="rounded-xl border bg-card p-4 md:p-6">
              <TaskForm
                mode="edit"
                taskId={task.id}
                defaults={editDefaults(task)}
                options={editOptions(options, task, today)}
              />
            </div>
          </section>
          <section aria-label="Archive" className="border-t pt-6">
            <ArchiveTaskButton taskId={task.id} title={task.title} />
          </section>
        </>
      )}
    </article>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-h-9 min-w-0 items-center">{children}</dd>
    </div>
  )
}

type TaskLink = { key: string; href: Route; icon: LucideIcon; kind: string; label: string }

function TaskLinks({ task, today }: { task: TaskDetail; today: IsoDate }) {
  const { organization, session, keyResult, teamMeeting, orgMeeting } = task.links
  const items: TaskLink[] = []
  if (organization) {
    items.push({
      key: "org",
      href: orgListHref(organization.kind),
      icon: Building2,
      kind: orgKindLabels[organization.kind].singular,
      label: organization.archived ? `${organization.name} (archived)` : organization.name,
    })
  }
  if (session) {
    items.push({
      key: "session",
      href: "/program",
      icon: CalendarDays,
      kind: "Synthe6 session",
      label: session.label,
    })
  }
  if (keyResult) {
    items.push({
      key: "kr",
      href: "/okrs",
      icon: Target,
      kind: "Key result",
      label: keyResult.label,
    })
  }
  if (teamMeeting) {
    items.push({
      key: "team-meeting",
      href: "/meetings",
      icon: Users,
      kind: "Sunday meeting",
      label:
        formatDate(teamMeeting.meetingDate, "medium") + dayNote(teamMeeting.meetingDate, today),
    })
  }
  if (orgMeeting) {
    items.push({
      key: "org-meeting",
      href: orgMeeting.org ? orgListHref(orgMeeting.org.kind) : "/investors",
      icon: Handshake,
      kind: orgMeeting.org ? `${orgKindLabels[orgMeeting.org.kind].singular} meeting` : "Meeting",
      label: orgMeeting.org
        ? orgMeetingLabel(orgMeeting.org.name, orgMeeting.startsAt)
        : formatDateTime(orgMeeting.startsAt),
    })
  }
  if (items.length === 0) return null

  return (
    <section aria-labelledby="task-links" className="space-y-2">
      <h2 id="task-links" className="text-sm font-medium text-muted-foreground">
        Linked to
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <item.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{item.kind}</span>
                <span className="block break-words">{item.label}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function dayNote(day: IsoDate, today: IsoDate): string {
  return day === today ? " (today)" : ""
}

function ActorName({ actor }: { actor: TaskActor }) {
  if (actor.kind === "system")
    return <span className="font-medium">{ACTOR_KIND_LABELS.system}</span>
  return (
    <>
      <span className="font-medium">{actor.name}</span>
      {actor.kind === "bot" ? (
        <Badge variant="secondary" className="ml-1.5 align-middle">
          <Bot aria-hidden />
          {ACTOR_KIND_LABELS.bot}
        </Badge>
      ) : null}
    </>
  )
}

/** "Created by John on …" / "Last changed by Grok (via Grok) on …" / "Done on …". */
function TaskHistory({ task }: { task: TaskDetail }) {
  const changed = task.updatedAt !== task.createdAt
  return (
    <section aria-label="History" className="space-y-1 text-sm text-muted-foreground">
      <p>
        Created by <ActorName actor={task.createdBy} /> on {formatDateTime(task.createdAt)}
      </p>
      {changed ? (
        <p>
          Last changed by <ActorName actor={task.updatedBy} /> on {formatDateTime(task.updatedAt)}
        </p>
      ) : null}
      {task.completedAt ? <p>Done on {formatDateTime(task.completedAt)}</p> : null}
    </section>
  )
}

function editDefaults(task: TaskDetail): TaskFormDefaults {
  const { links } = task
  return {
    title: task.title,
    next_action: task.nextAction,
    owner_id: task.ownerId,
    due_date: task.dueDate,
    status: task.status,
    priority: task.priority,
    notes: task.notes ?? "",
    organization_id: links.organization?.id ?? "",
    synthe6_session_id: links.session?.id ?? "",
    key_result_id: links.keyResult?.id ?? "",
    team_meeting_id: links.teamMeeting?.id ?? "",
    org_meeting_id: links.orgMeeting?.id ?? "",
  }
}

/**
 * The form's choices, plus whatever the task already points at but the lists
 * leave out (a former teammate, an archived org, an older session or meeting),
 * so saving never drops them silently.
 */
function editOptions(options: TaskFormOptions, task: TaskDetail, today: IsoDate): TaskFormOptions {
  const { organization, session, keyResult, teamMeeting, orgMeeting } = task.links
  const people = options.people.some((p) => p.id === task.ownerId)
    ? options.people
    : [...options.people, { id: task.ownerId, name: `${task.owner.name} (no longer on the team)` }]
  return {
    ...options,
    people,
    organizations: withCurrent(
      options.organizations,
      organization
        ? {
            value: organization.id,
            label: organization.archived ? `${organization.name} (archived)` : organization.name,
            kind: organization.kind,
          }
        : null,
    ),
    sessions: withCurrent(
      options.sessions,
      session ? { value: session.id, label: session.label } : null,
    ),
    keyResults: withCurrent(
      options.keyResults,
      keyResult ? { value: keyResult.id, label: keyResult.label } : null,
    ),
    teamMeetings: withCurrent(
      options.teamMeetings,
      teamMeeting
        ? { value: teamMeeting.id, label: teamMeetingLabel(teamMeeting.meetingDate, today) }
        : null,
    ),
    orgMeetings: withCurrent(
      options.orgMeetings,
      orgMeeting
        ? {
            value: orgMeeting.id,
            label: orgMeeting.org
              ? orgMeetingLabel(orgMeeting.org.name, orgMeeting.startsAt)
              : formatDateTime(orgMeeting.startsAt),
          }
        : null,
    ),
  }
}
