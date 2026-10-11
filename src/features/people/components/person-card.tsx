import Link from "next/link"
import { PersonAvatar } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import type { PersonCard as PersonCardData } from "@/features/people/queries"
import { cn } from "@/lib/utils"

/**
 * One teammate on /people: who they are, how to reach them, their top
 * strengths and what they own. The whole card opens their profile (the name
 * is the one link; its ::after covers the card).
 */
export function PersonCard({ person, isMe }: { person: PersonCardData; isMe: boolean }) {
  const counts = [
    { label: "Open tasks", value: person.openTasks },
    { label: "Investors", value: person.investorsOwned },
    { label: "Customers", value: person.customersOwned },
    { label: "Key results", value: person.keyResultsOwned },
  ]
  return (
    <li
      className={cn(
        "relative flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors",
        "hover:bg-accent/50 has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <PersonAvatar person={person} className="size-12" />
        <div className="min-w-0 flex-1">
          <h2 className="flex min-w-0 items-center gap-2 font-semibold">
            <Link
              href={`/people/${person.id}`}
              className="truncate after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            >
              {person.name}
            </Link>
            {isMe ? (
              <Badge variant="secondary" className="shrink-0">
                You
              </Badge>
            ) : null}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{person.role}</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">How to reach me</p>
        {person.contactPreference ? (
          <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
            {person.contactPreference}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Not set yet — add it on {isMe ? "your" : "their"} profile
          </p>
        )}
      </div>

      {person.strengths.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Top strengths</p>
          <ol className="flex flex-wrap gap-1.5">
            {person.strengths.map((strength, index) => (
              <li key={strength}>
                <Badge variant="outline" className="font-normal">
                  <span className="sr-only">{index + 1}. </span>
                  {strength}
                </Badge>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <dl className="mt-auto grid grid-cols-4 gap-1 border-t pt-3 text-center">
        {counts.map((count) => (
          <div key={count.label} className="flex min-w-0 flex-col-reverse gap-0.5">
            <dt className="text-xs leading-tight text-muted-foreground">{count.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{count.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  )
}
