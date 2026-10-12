import type { Route } from "next"
import { CircleCheck } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { orgHref } from "@/features/orgs/links"
import { taskHref, tasksViewHref } from "@/features/tasks/links"
import { requireTeamMember } from "@/lib/auth"
import { debriefKindLabels, orgKindLabels } from "@/lib/labels"
import { askedLabel, moreCount, staleLabel } from "../logic"
import { getNeedsAttention, requestClock, type Counted } from "../queries"
import { ItemRow, MoreLink, MoreLinks, SectionCard, SubList } from "./section-card"
import { SECTIONS } from "./sections"

function hiddenOf<T>(list: Counted<T>): number {
  return moreCount(list.total, list.items.length)
}

const ORG_LINKS = (
  <MoreLinks>
    <MoreLink href="/investors">Investors</MoreLink>
    <MoreLink href="/customers">Customers</MoreLink>
  </MoreLinks>
)

/**
 * Team-wide items that are late or waiting, each with its owner ("who can I
 * ask?"). Only lists with something in them show; when all are empty the card
 * says so, calmly.
 */
export async function NeedsAttentionSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const { overdueTasks, overdueFollowUps, staleOrgs, debriefsDue, helpRequests } =
    await getNeedsAttention({ me, today, now })
  const total =
    overdueTasks.total +
    overdueFollowUps.total +
    staleOrgs.total +
    debriefsDue.total +
    helpRequests.total
  const { id, title, icon } = SECTIONS.needsAttention

  if (total === 0) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CircleCheck}
          title="Nothing needs attention"
          description="No overdue tasks or follow-ups, no investors or customers gone quiet for 14+ days, no debriefs due, and no open help requests. Anything that slips shows up here for the whole team."
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
    >
      {overdueTasks.total > 0 ? (
        <SubList
          id="attention-tasks"
          title="Overdue tasks"
          count={overdueTasks.total}
          countLabel="overdue"
          tone="overdue"
          hidden={hiddenOf(overdueTasks)}
          more={<MoreLink href={tasksViewHref("owner")}>Tasks by owner</MoreLink>}
        >
          {overdueTasks.items.map((task) => (
            <ItemRow key={task.id} href={taskHref(task.id)} title={task.title}>
              <PersonChip person={task.owner} size="sm" />
              <DueDate date={task.dueDate} today={today} />
            </ItemRow>
          ))}
        </SubList>
      ) : null}

      {overdueFollowUps.total > 0 ? (
        <SubList
          id="attention-follow-ups"
          title="Overdue follow-ups"
          count={overdueFollowUps.total}
          countLabel="overdue"
          tone="overdue"
          hidden={hiddenOf(overdueFollowUps)}
          more={ORG_LINKS}
        >
          {overdueFollowUps.items.map((org) => (
            <ItemRow
              key={org.id}
              href={orgHref(org.kind, org.id)}
              title={org.name}
              detail={
                <>
                  <span className="sr-only">Next step: </span>
                  {org.nextStep}
                </>
              }
            >
              <PersonChip person={org.owner} size="sm" />
              <DueDate date={org.nextStepDate} today={today} />
              <span>{orgKindLabels[org.kind].singular}</span>
            </ItemRow>
          ))}
        </SubList>
      ) : null}

      {staleOrgs.total > 0 ? (
        <SubList
          id="attention-stale"
          title="No contact in 14+ days"
          count={staleOrgs.total}
          countLabel="gone quiet"
          tone="stale"
          hidden={hiddenOf(staleOrgs)}
          more={ORG_LINKS}
        >
          {staleOrgs.items.map((org) => (
            <ItemRow key={org.id} href={orgHref(org.kind, org.id)} title={org.name}>
              <PersonChip person={org.owner} size="sm" />
              <span className="font-medium text-stale">
                {staleLabel(org.daysSinceContact, org.lastContactDate)}
              </span>
              <span>{orgKindLabels[org.kind].singular}</span>
            </ItemRow>
          ))}
        </SubList>
      ) : null}

      {debriefsDue.total > 0 ? (
        <SubList
          id="attention-debriefs"
          title="Debriefs due"
          count={debriefsDue.total}
          countLabel="due"
          hidden={hiddenOf(debriefsDue)}
          more={<MoreLink href="/debriefs">All debriefs</MoreLink>}
        >
          {debriefsDue.items.map((debrief) => (
            <ItemRow key={debrief.id} href="/debriefs" title={debrief.subject}>
              {debrief.facilitator ? (
                <PersonChip person={debrief.facilitator} size="sm" />
              ) : (
                <span>No facilitator</span>
              )}
              <DueDate date={debrief.dueDate} today={today} />
              <span>{debriefKindLabels[debrief.kind]}</span>
            </ItemRow>
          ))}
        </SubList>
      ) : null}

      {helpRequests.total > 0 ? (
        <SubList
          id="attention-help"
          title="Open help requests"
          count={helpRequests.total}
          countLabel="open"
          hidden={hiddenOf(helpRequests)}
          more={<MoreLink href="/people">People</MoreLink>}
        >
          {helpRequests.items.map((help) => (
            <ItemRow
              key={help.id}
              // The asker's profile says how to reach them.
              href={`/people/${encodeURIComponent(help.requester.id)}` as Route}
              title={<span className="line-clamp-3">{help.message}</span>}
            >
              <PersonChip person={help.requester} size="sm" />
              <span>{askedLabel(help.createdAt, today)}</span>
            </ItemRow>
          ))}
        </SubList>
      ) : null}
    </SectionCard>
  )
}
