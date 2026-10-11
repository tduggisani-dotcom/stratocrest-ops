import Link from "next/link"
import { CalendarX } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { PersonChip } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireTeamMember } from "@/lib/auth"
import { sessionEmphasisLabels } from "@/lib/labels"
import { sentenceCase, sessionCountdown, sessionDateLabel, sessionTimeLabel } from "../logic"
import { getNextSession, requestClock } from "../queries"
import { MoreLink, SectionCard } from "./section-card"
import { SECTIONS } from "./sections"

/**
 * The next Synthe6 session (not a break week): when, how far away, format,
 * activity, topic, any emphasis (OKR share-out, mentor coaching, Demo Day
 * prep), and who owns the prep. Times show only once they're known.
 */
export async function NextSessionSection() {
  const me = await requireTeamMember()
  const { today, now } = requestClock()
  const session = await getNextSession({ me, today, now })
  const { id, title, icon } = SECTIONS.nextSession
  const programLink = <MoreLink href="/program">Program</MoreLink>

  if (!session) {
    return (
      <SectionCard id={id} title={title} icon={icon}>
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CalendarX}
          title="No sessions left"
          description="The Synthe6 schedule has no upcoming sessions. The full program, with past sessions and their debriefs, is on the Program page."
          action={
            <Button asChild variant="outline" className="max-md:w-full">
              <Link href="/program">Go to the program</Link>
            </Button>
          }
          className="flex-1 justify-center"
        />
      </SectionCard>
    )
  }

  const time = sessionTimeLabel(session.startDate, session.startTime, session.endTime)
  const details = [
    { term: "Format", value: session.format },
    { term: "Activity", value: session.activityType },
    { term: "Topic", value: session.topic },
  ].filter((d): d is { term: string; value: string } => Boolean(d.value?.trim()))

  return (
    <SectionCard id={id} title={title} icon={icon} action={programLink}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {session.weekLabel ? <Badge variant="secondary">{session.weekLabel}</Badge> : null}
          {session.emphasis ? (
            <Badge variant="outline">{sessionEmphasisLabels[session.emphasis]}</Badge>
          ) : null}
        </div>
        <p className="text-lg font-semibold tracking-tight">
          <time dateTime={session.startDate}>
            {sessionDateLabel(session.startDate, session.endDate)}
          </time>
          {time ? <span className="font-normal text-muted-foreground"> · {time}</span> : null}
        </p>
        <p className="text-sm font-medium">
          {sentenceCase(sessionCountdown(session.startDate, session.endDate, today))}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {details.map((d) => (
          <div key={d.term} className="contents">
            <dt className="text-muted-foreground">{d.term}</dt>
            <dd className="min-w-0 break-words">{d.value}</dd>
          </div>
        ))}
        {session.owner ? (
          <div className="contents">
            <dt className="self-center text-muted-foreground">Owner</dt>
            <dd className="min-w-0">
              <PersonChip person={session.owner} size="sm" />
            </dd>
          </div>
        ) : null}
      </dl>
    </SectionCard>
  )
}
