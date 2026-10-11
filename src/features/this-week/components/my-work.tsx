import Link from "next/link"
import { ArrowUp, CircleCheck, Plus } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { EmptyState } from "@/components/common/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { newTaskHref, orgListHref, taskHref, tasksViewHref } from "@/features/tasks/links"
import { requireTeamMember } from "@/lib/auth"
import { debriefKindLabels, orgKindLabels, taskStatusLabels } from "@/lib/labels"
import { moreCount } from "../logic"
import { getMyWork, requestClock } from "../queries"
import { ItemRow, MoreLink, MoreLinks, SectionCard, SubList } from "./section-card"
import { SECTIONS } from "./sections"

/** Adding a task from This Week comes back here after saving. */
const ADD_TASK_HREF = newTaskHref({ returnTo: "/" })

/**
 * "What do I need to do?": the signed-in person's open tasks (overdue first),
 * their investors' and customers' next steps due by Sunday, and the debriefs
 * they facilitate that are due. Everything here is theirs, so no owner chips.
 */
export async function MyWorkSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const { tasks, followUps, debriefs } = await getMyWork({ me, today, now })
  const total = tasks.total + followUps.total + debriefs.total
  const { id, title, icon } = SECTIONS.myWork

  if (total === 0) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CircleCheck}
          title="You're all caught up"
          description="No open tasks, no follow-ups due by Sunday, and no debriefs waiting on you. Tasks you own show up here, soonest first."
          action={
            <Button asChild className="max-md:w-full">
              <Link href={ADD_TASK_HREF}>
                <Plus aria-hidden />
                Add a task
              </Link>
            </Button>
          }
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      id={id}
      title={title}
      icon={icon}
      count={{ value: total, label: total === 1 ? "item" : "items" }}
      action={
        <Button asChild variant="outline">
          <Link href={ADD_TASK_HREF}>
            <Plus aria-hidden />
            Add task
          </Link>
        </Button>
      }
    >
      <SubList
        id="my-work-tasks"
        title="Open tasks"
        count={tasks.total}
        countLabel="open"
        empty="No open tasks."
        hidden={moreCount(tasks.total, tasks.items.length)}
        more={
          tasks.total > 0 ? (
            <MoreLink href={tasksViewHref("mine")}>See all my tasks</MoreLink>
          ) : null
        }
      >
        {tasks.items.map((task) => (
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
            <DueDate date={task.dueDate} today={today} />
            {task.status !== "to_do" ? (
              <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
            ) : null}
            {task.priority === "high" ? (
              <Badge variant="outline">
                <ArrowUp aria-hidden />
                High priority
              </Badge>
            ) : null}
          </ItemRow>
        ))}
      </SubList>

      <SubList
        id="my-work-follow-ups"
        title="Follow-ups due by Sunday"
        count={followUps.total}
        countLabel="due"
        empty="No investor or customer next steps due by Sunday."
        hidden={moreCount(followUps.total, followUps.items.length)}
        more={
          followUps.total > 0 ? (
            <MoreLinks>
              <MoreLink href="/investors">Investors</MoreLink>
              <MoreLink href="/customers">Customers</MoreLink>
            </MoreLinks>
          ) : null
        }
      >
        {followUps.items.map((org) => (
          <ItemRow
            key={org.id}
            href={orgListHref(org.kind)}
            title={org.name}
            detail={
              <>
                <span className="sr-only">Next step: </span>
                {org.nextStep}
              </>
            }
          >
            <DueDate date={org.nextStepDate} today={today} />
            <span>{orgKindLabels[org.kind].singular}</span>
          </ItemRow>
        ))}
      </SubList>

      <SubList
        id="my-work-debriefs"
        title="Debriefs due"
        count={debriefs.total}
        countLabel="due"
        empty="No debriefs due."
        hidden={moreCount(debriefs.total, debriefs.items.length)}
        more={debriefs.total > 0 ? <MoreLink href="/debriefs">All debriefs</MoreLink> : null}
      >
        {debriefs.items.map((debrief) => (
          <ItemRow key={debrief.id} href="/debriefs" title={debrief.subject}>
            <DueDate date={debrief.dueDate} today={today} />
            <span>{debriefKindLabels[debrief.kind]}</span>
          </ItemRow>
        ))}
      </SubList>
    </SectionCard>
  )
}
