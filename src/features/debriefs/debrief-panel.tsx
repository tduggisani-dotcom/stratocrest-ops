import { CircleCheck } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip } from "@/components/common/person-chip"
import { formatDate, toEtDate, type IsoDate } from "@/lib/dates"
import { DebriefDisclosure } from "./debrief-disclosure"
import { DebriefForm } from "./debrief-form"
import { DEBRIEF_QUESTIONS } from "./template"
import type { DebriefDetail } from "./types"

/**
 * A debrief where it's written: its status (due, overdue in red, or done in
 * green) and facilitator, then the template form. A done debrief shows its
 * answers, with the form folded under "Edit or reopen". Server-safe (no hooks);
 * pass `today` (ET) from the server.
 */
export function DebriefPanel({
  debrief,
  people,
  today,
}: {
  debrief: DebriefDetail
  people: readonly { id: string; name: string }[]
  today: IsoDate
}) {
  const done = debrief.status === "done"
  return (
    <div className="space-y-4">
      <DebriefStatus debrief={debrief} today={today} />
      {done ? <DebriefAnswers debrief={debrief} /> : null}
      {/* One place in the tree for the form, so marking it done doesn't remount it. */}
      <DebriefDisclosure collapsed={done}>
        <DebriefForm debrief={debrief} people={people} />
      </DebriefDisclosure>
    </div>
  )
}

/** "Done Oct 12 · Facilitator: Sam" or "Due Oct 12 · today · Facilitator: Sam". */
export function DebriefStatus({ debrief, today }: { debrief: DebriefDetail; today: IsoDate }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {debrief.status === "done" ? (
        <span className="inline-flex items-center gap-1 font-medium text-good">
          <CircleCheck aria-hidden className="size-4" />
          Done
          {debrief.completedAt ? ` ${formatDate(toEtDate(debrief.completedAt), "short")}` : ""}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <span>Due</span>
          <DueDate date={debrief.dueDate} today={today} />
        </span>
      )}
      {debrief.facilitator ? (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="text-xs">Facilitator:</span>
          <PersonChip person={debrief.facilitator} size="sm" />
        </span>
      ) : (
        <span className="text-xs">No facilitator yet</span>
      )}
    </p>
  )
}

/** The four answers of a done debrief, as written. */
function DebriefAnswers({ debrief }: { debrief: DebriefDetail }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {DEBRIEF_QUESTIONS.map(({ field, label }) => (
        <div key={field} className="min-w-0 space-y-1">
          <dt className="text-sm font-medium">{label}</dt>
          <dd className="text-sm break-words whitespace-pre-line text-muted-foreground">
            {debrief[field] ?? <span className="italic">Not written</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
