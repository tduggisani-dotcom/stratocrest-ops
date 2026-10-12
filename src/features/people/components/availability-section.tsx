import { CalendarClockIcon } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { firstNameOf } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { removeAvailabilityBlock } from "@/features/people/actions"
import {
  availabilityBlockName,
  formatTimeRange,
  groupByWeekday,
  type AvailabilityBlock,
} from "@/features/people/format"
import { availabilityLabelLabels } from "@/lib/labels"
import { AvailabilityForm } from "./availability-form"
import { ProfileSection, SubHeading } from "./profile-section"
import { RemoveButton } from "./remove-button"

const SECTION_ID = "busy"
const ADD_HEADING_ID = "busy-add-heading"

/** "When they're busy": the weekly class / work / other blocks, Monday to Sunday, in ET. */
export function AvailabilitySection({
  personId,
  name,
  blocks,
}: {
  personId: string
  name: string
  blocks: AvailabilityBlock[]
}) {
  const firstName = firstNameOf(name)
  const days = groupByWeekday(blocks)
  return (
    <ProfileSection
      id={SECTION_ID}
      title="When they're busy"
      description={`${firstName}'s regular weekly commitments, so the team knows when not to expect a quick reply. Times are Eastern (ET).`}
    >
      {blocks.length > 0 ? (
        <ul aria-label={`${firstName}'s week`} className="divide-y rounded-xl border">
          {days.map((day) => (
            <li
              key={day.weekday}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
            >
              <span className="text-sm font-medium sm:w-28 sm:shrink-0 sm:pt-2.5">{day.label}</span>
              {day.blocks.length > 0 ? (
                <ul aria-label={day.label} className="min-w-0 flex-1 space-y-1">
                  {day.blocks.map((block) => (
                    <li key={block.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 py-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="tabular-nums">
                            {formatTimeRange(block.startTime, block.endTime)}
                          </span>
                          <Badge variant="outline">{availabilityLabelLabels[block.label]}</Badge>
                        </p>
                        {block.note ? (
                          <p className="text-xs break-words text-muted-foreground">{block.note}</p>
                        ) : null}
                      </div>
                      <RemoveButton
                        action={removeAvailabilityBlock}
                        id={block.id}
                        label={`Remove ${availabilityBlockName(block)}`}
                        returnFocusId={`${SECTION_ID}-heading`}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-muted-foreground sm:pt-2.5">Nothing scheduled</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          size="compact"
          titleAs="h3"
          icon={CalendarClockIcon}
          title="No busy times yet"
          description={`Add ${firstName}'s classes, work shifts and other regular commitments. Teammates see them here before asking for something urgent.`}
          action={
            <Button asChild variant="outline">
              <a href="#busy-add">Add the first busy time</a>
            </Button>
          }
        />
      )}

      <div id="busy-add" className="scroll-mt-20 space-y-3 rounded-xl border p-4">
        <SubHeading id={ADD_HEADING_ID}>Add a busy time</SubHeading>
        <AvailabilityForm personId={personId} headingId={ADD_HEADING_ID} />
      </div>
    </ProfileSection>
  )
}
