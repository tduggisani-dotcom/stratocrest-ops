import Link from "next/link"
import { TriangleAlertIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { plural } from "@/features/people/format"
import type { PersonCard } from "@/features/people/queries"

/**
 * Deactivated teammates on /people, each linking to their profile, with a note
 * when they still own open items that someone should take over. The note is a
 * neutral badge: amber is only for "stale" (spec §7).
 */
export function FormerTeammates({ people }: { people: PersonCard[] }) {
  return (
    <section aria-labelledby="former-heading" className="space-y-3">
      <h2 id="former-heading" className="text-sm font-semibold text-muted-foreground">
        Former teammates
      </h2>
      <ul className="divide-y rounded-xl border">
        {people.map((person) => {
          const open = person.openTasks + person.investorsOwned + person.customersOwned
          return (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="flex min-h-11 flex-col gap-1 px-4 py-2.5 hover:bg-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="min-w-0">
                  <span className="font-medium">{person.name}</span>
                  <span className="text-muted-foreground"> · {person.role}</span>
                </span>
                {open > 0 ? (
                  <Badge variant="outline" className="shrink-0 [&>svg]:size-3.5">
                    <TriangleAlertIcon aria-hidden />
                    {plural(open, "open item")} to hand over
                  </Badge>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
