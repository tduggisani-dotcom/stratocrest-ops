import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Contact } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { LiveRefresh } from "@/components/common/live-refresh"
import { navItem } from "@/components/shell/nav-config"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { PersonCard } from "@/features/people/components/person-card"
import { PeopleGridSkeleton } from "@/features/people/components/skeletons"
import { plural } from "@/features/people/format"
import { listPeople } from "@/features/people/queries"
import { requireTeamMember } from "@/lib/auth"

export const metadata: Metadata = { title: navItem("/people").label }

/** /people: everyone on the team, how to reach them, and what they own. */
export default function PeoplePage() {
  return (
    <>
      <PageHeader
        title={navItem("/people").label}
        description="Who's on the team and how to reach them."
      />
      <Suspense fallback={<PeopleGridSkeleton />}>
        <PeopleList />
      </Suspense>
    </>
  )
}

async function PeopleList() {
  const me = await requireTeamMember()
  const { active, former } = await listPeople()

  return (
    <div className="space-y-10">
      <LiveRefresh tables={["people", "tasks", "organizations", "key_results"]} />
      {active.length > 0 ? (
        <ul aria-label="Team" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((person) => (
            <PersonCard key={person.id} person={person} isMe={person.id === me.id} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Contact}
          title="No teammates yet"
          description="Everyone on the StratoCrest team shows here with their role, how to reach them, and what they own. Teammates are added during setup; start by completing your own profile."
          action={
            <Button asChild>
              <Link href={`/people/${me.id}`}>Open your profile</Link>
            </Button>
          }
        />
      )}

      {former.length > 0 ? (
        <section aria-labelledby="former-heading" className="space-y-3">
          <h2 id="former-heading" className="text-sm font-semibold text-muted-foreground">
            Former teammates
          </h2>
          <ul className="divide-y rounded-xl border">
            {former.map((person) => {
              const open = person.openTasks + person.investorsOwned + person.customersOwned
              return (
                <li key={person.id}>
                  <Link
                    href={`/people/${person.id}`}
                    className="flex min-h-11 flex-col gap-0.5 px-4 py-2.5 hover:bg-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{person.name}</span>
                      <span className="text-muted-foreground"> · {person.role}</span>
                    </span>
                    {open > 0 ? (
                      <span className="text-sm text-stale">
                        {plural(open, "open item")} to hand over
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
