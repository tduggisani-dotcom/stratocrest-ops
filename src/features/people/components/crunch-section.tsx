import { CalendarRangeIcon } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { firstNameOf } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { removeCrunchPeriod } from "@/features/people/actions"
import { crunchTiming, formatDateRange, type CrunchPeriodView } from "@/features/people/format"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { CrunchForm } from "./crunch-form"
import { ProfileSection, SubHeading } from "./profile-section"
import { RemoveButton } from "./remove-button"

const SECTION_ID = "crunch"
const ADD_HEADING_ID = "crunch-add-heading"

/**
 * "Crunch periods": current and upcoming first (a current one marked "Now"),
 * then recent past. Neutral styling: amber is only for "stale" (spec §7).
 */
export function CrunchSection({
  personId,
  name,
  upcoming,
  past,
  today,
}: {
  personId: string
  name: string
  upcoming: CrunchPeriodView[]
  past: CrunchPeriodView[]
  today: IsoDate
}) {
  const firstName = firstNameOf(name)
  const none = upcoming.length === 0 && past.length === 0
  return (
    <ProfileSection
      id={SECTION_ID}
      title="Crunch periods"
      description="Finals, a deadline at work, travel: stretches with less time for StratoCrest. Tasks due during a crunch period get a gentle warning."
    >
      {none ? (
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CalendarRangeIcon}
          title="No crunch periods yet"
          description={`Add ${firstName}'s busy stretches, like finals week, so tasks aren't quietly piled onto them.`}
          action={
            <Button asChild variant="outline">
              <a href="#crunch-add">Add the first crunch period</a>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <SubHeading id="crunch-upcoming">Now and coming up</SubHeading>
            {upcoming.length > 0 ? (
              <CrunchList labelledBy="crunch-upcoming" periods={upcoming} today={today} />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing coming up.</p>
            )}
          </div>
          {past.length > 0 ? (
            <div className="space-y-2">
              <SubHeading id="crunch-past">Recent</SubHeading>
              <CrunchList labelledBy="crunch-past" periods={past} today={today} muted />
            </div>
          ) : null}
        </div>
      )}

      <div id="crunch-add" className="scroll-mt-20 space-y-3 rounded-xl border p-4">
        <SubHeading id={ADD_HEADING_ID}>Add a crunch period</SubHeading>
        <CrunchForm personId={personId} headingId={ADD_HEADING_ID} />
      </div>
    </ProfileSection>
  )
}

function CrunchList({
  periods,
  today,
  labelledBy,
  muted = false,
}: {
  periods: CrunchPeriodView[]
  today: IsoDate
  labelledBy: string
  muted?: boolean
}) {
  return (
    <ul aria-labelledby={labelledBy} className="divide-y rounded-xl border">
      {periods.map((period) => (
        <li key={period.id} className="flex items-center justify-between gap-3 px-4 py-2">
          <div className={cn("min-w-0 py-1", muted && "text-muted-foreground")}>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
              <span className="min-w-0 break-words">{period.label}</span>
              {/* A marker to spot at a glance; the timing below says "Happening now". */}
              {period.isCurrent ? (
                <Badge variant="outline" aria-hidden>
                  Now
                </Badge>
              ) : null}
            </p>
            <p className="text-sm">
              <span className="tabular-nums">
                {formatDateRange(period.startDate, period.endDate)}
              </span>
              <span aria-hidden> · </span>
              <span className={period.isCurrent ? "font-medium" : "text-muted-foreground"}>
                {crunchTiming(period, today)}
              </span>
            </p>
          </div>
          <RemoveButton
            action={removeCrunchPeriod}
            id={period.id}
            label={`Remove ${period.label} crunch period`}
            returnFocusId={`${SECTION_ID}-heading`}
          />
        </li>
      ))}
    </ul>
  )
}
