import {
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { hypothesisDecisionLabels, hypothesisStatusLabels, testOutcomeLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { HypothesisDecision, HypothesisStatus, TestOutcome } from "./types"

/**
 * Status, outcome and decision badges. Colour follows spec §7: Validated is
 * good news (green); Invalidated is learning, not a failure, so it stays
 * neutral with an icon (red is only for overdue). Outcomes and decisions are
 * neutral; the icon and the word carry the meaning. Server-safe (no hooks).
 */

export const STATUS_ICONS: Record<HypothesisStatus, LucideIcon> = {
  untested: CircleDashed,
  validated: CircleCheck,
  invalidated: CircleX,
}

const OUTCOME_ICONS: Record<TestOutcome, LucideIcon> = {
  supports: ThumbsUp,
  contradicts: ThumbsDown,
  inconclusive: CircleHelp,
}

/** The colour classes for a status (green only for Validated). */
export function statusTone(status: HypothesisStatus): string {
  return status === "validated" ? "border-transparent bg-good-soft text-good" : ""
}

export function HypothesisStatusBadge({
  status,
  className,
}: {
  status: HypothesisStatus
  className?: string
}) {
  const Icon = STATUS_ICONS[status]
  return (
    <Badge variant="outline" className={cn(statusTone(status), className)}>
      <Icon aria-hidden />
      {hypothesisStatusLabels[status]}
    </Badge>
  )
}

export function OutcomeBadge({ outcome, className }: { outcome: TestOutcome; className?: string }) {
  const Icon = OUTCOME_ICONS[outcome]
  return (
    <Badge variant="outline" className={className}>
      <Icon aria-hidden />
      {testOutcomeLabels[outcome]}
    </Badge>
  )
}

export function DecisionBadge({ decision }: { decision: HypothesisDecision }) {
  return (
    <Badge variant="secondary">
      <span className="font-normal">Decision:</span> {hypothesisDecisionLabels[decision]}
    </Badge>
  )
}
