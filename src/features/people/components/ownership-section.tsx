import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { firstNameOf } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { OwnedKeyResult, OwnedOrg, OwnedTask } from "@/features/people/queries"
import { orgHref } from "@/features/orgs/links"
import { newTaskHref, taskHref } from "@/features/tasks/links"
import type { IsoDate } from "@/lib/dates"
import { orgKindLabels, taskStatusLabels } from "@/lib/labels"
import { krPercent, krProgressText } from "@/lib/okr"
import { cn } from "@/lib/utils"
import { EmptyLine, ProfileSection, SubHeading } from "./profile-section"

const ROW =
  "-mx-2 flex min-h-11 flex-col gap-1 rounded-md px-2 py-2 hover:bg-accent focus-visible:bg-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"

/** "What they own": open investors/customers, key results, and open tasks. */
export function OwnershipSection({
  personId,
  name,
  orgs,
  keyResults,
  openTasks,
  today,
}: {
  personId: string
  name: string
  orgs: OwnedOrg[]
  keyResults: OwnedKeyResult[]
  openTasks: OwnedTask[]
  today: IsoDate
}) {
  const firstName = firstNameOf(name)
  const addTaskHref = newTaskHref({ owner: personId, returnTo: `/people/${personId}` })
  return (
    <ProfileSection
      id="owns"
      title="What they own"
      description={`Everything ${firstName} is the owner of. Every item has one owner, a next step, and a date.`}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <SubHeading id="owns-tasks" count={openTasks.length}>
            Open tasks
          </SubHeading>
          {openTasks.length > 0 ? (
            <>
              <ul aria-labelledby="owns-tasks" className="divide-y">
                {openTasks.map((task) => (
                  <li key={task.id}>
                    <Link href={taskHref(task.id)} className={ROW}>
                      <span className="min-w-0 font-medium break-words">{task.title}</span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2">
                        <DueDate date={task.dueDate} today={today} />
                        {task.status !== "to_do" ? (
                          <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="max-sm:w-full">
                <Link href={addTaskHref}>
                  <PlusIcon aria-hidden />
                  Add a task for {firstName}
                </Link>
              </Button>
            </>
          ) : (
            <EmptyLine
              action={
                <Button asChild variant="outline">
                  <Link href={addTaskHref}>
                    <PlusIcon aria-hidden />
                    Add a task for {firstName}
                  </Link>
                </Button>
              }
            >
              No open tasks. Tasks {firstName} owns that aren&apos;t done yet show here, soonest
              first.
            </EmptyLine>
          )}
        </div>

        <div className="space-y-2">
          <SubHeading id="owns-orgs" count={orgs.length}>
            Investors &amp; customers
          </SubHeading>
          {orgs.length > 0 ? (
            <ul aria-labelledby="owns-orgs" className="divide-y">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link href={orgHref(org.kind, org.id)} className={ROW}>
                    <span className="min-w-0">
                      <span className="block font-medium break-words">{org.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {orgKindLabels[org.kind].singular} · {org.stageLabel}
                      </span>
                      <span className="block text-sm break-words text-muted-foreground">
                        Next: {org.nextStep}
                      </span>
                    </span>
                    <DueDate date={org.nextStepDate} today={today} className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine
              action={
                <Button asChild variant="outline">
                  <Link href="/investors">Go to Investors</Link>
                </Button>
              }
            >
              No open investors or customers. The ones {firstName} is the point of contact for show
              here with their next step.
            </EmptyLine>
          )}
        </div>

        <div className="space-y-2">
          <SubHeading id="owns-krs" count={keyResults.length}>
            Key results
          </SubHeading>
          {keyResults.length > 0 ? (
            <ul aria-labelledby="owns-krs" className="divide-y">
              {keyResults.map((kr) => {
                // The same rule as This Week: 100% (and green) only once the target is reached.
                const percent = krPercent(kr)
                return (
                  <li key={kr.id}>
                    <Link href="/okrs" className={`${ROW} sm:flex-col sm:items-stretch sm:gap-1.5`}>
                      <span className="min-w-0">
                        <span className="block font-medium break-words">{kr.title}</span>
                        <span className="block text-xs break-words text-muted-foreground">
                          {kr.quarterLabel ? `${kr.quarterLabel} · ` : ""}
                          {kr.objectiveTitle}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          aria-hidden
                          className="h-2 min-w-24 flex-1 basis-32 overflow-hidden rounded-full bg-muted"
                        >
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              percent >= 100 ? "bg-good" : "bg-primary",
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="min-w-0 text-sm break-words text-muted-foreground tabular-nums">
                          {krProgressText(kr)} · {percent}%
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyLine
              action={
                <Button asChild variant="outline">
                  <Link href="/okrs">Go to OKRs</Link>
                </Button>
              }
            >
              No key results yet. The quarterly key results {firstName} owns show here with progress
              toward each target.
            </EmptyLine>
          )}
        </div>
      </div>
    </ProfileSection>
  )
}
