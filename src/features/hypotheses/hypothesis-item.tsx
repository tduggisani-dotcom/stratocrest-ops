import Link from "next/link"
import { PersonChip } from "@/components/common/person-chip"
import { kindConfig } from "@/features/orgs/kind-config"
import { hypothesisHref, orgHref } from "@/features/orgs/links"
import { formatDate } from "@/lib/dates"
import { orgKindLabels, testOutcomeLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { DecisionBadge, HypothesisStatusBadge } from "./badges"
import { evidenceText } from "./summary"
import type { HypothesisListItem } from "./types"

/**
 * One hypothesis in a list: status, the statement (a link to its page), its
 * owner, the evidence so far and, where useful, who it's about and the latest
 * evidence. Server-safe (no hooks). `data-hypothesis-id` lets a form focus
 * the hypothesis it just added.
 */
export function HypothesisItem({
  item,
  showAbout = false,
  showLatest = false,
  showStatus = true,
  className,
}: {
  item: HypothesisListItem
  /** The roll-up: which investor or customer it's about, or "Across …". */
  showAbout?: boolean
  /** The org page: the most recent evidence, in a line. */
  showLatest?: boolean
  /** Off where the list is already grouped by status. */
  showStatus?: boolean
  className?: string
}) {
  const latest = item.evidence.latest
  return (
    <li data-hypothesis-id={item.id} className={cn("min-w-0", className)}>
      <article className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground">
        {showStatus || item.decision ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {showStatus ? <HypothesisStatusBadge status={item.status} /> : null}
            {item.decision ? <DecisionBadge decision={item.decision} /> : null}
          </div>
        ) : null}
        <h3 className="text-sm leading-snug font-medium">
          <Link
            href={hypothesisHref(item.id)}
            data-hypothesis-link=""
            className="-mx-1 inline-flex min-h-11 items-center rounded-md px-1 break-words hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-0"
          >
            <span className="line-clamp-4">{item.statement}</span>
          </Link>
        </h3>
        {showAbout ? <AboutLine item={item} /> : null}
        {showLatest && latest ? (
          <p className="line-clamp-2 text-sm break-words text-muted-foreground">
            <span className="font-medium text-foreground">
              {testOutcomeLabels[latest.outcome]}, {formatDate(latest.testDate, "short")}:
            </span>{" "}
            {latest.evidence}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {item.owner ? (
            <PersonChip person={item.owner} size="sm" />
          ) : (
            <span className="text-xs">No owner yet</span>
          )}
          <span>{evidenceText(item.evidence)}</span>
          {!showLatest && latest ? (
            <span>
              Last tested{" "}
              <time dateTime={latest.testDate}>{formatDate(latest.testDate, "short")}</time>
            </span>
          ) : null}
        </div>
      </article>
    </li>
  )
}

/** "Customer · Acme Steel" (a link to it), or "Across customers". */
function AboutLine({ item }: { item: HypothesisListItem }) {
  if (item.org) {
    const { singular } = kindConfig(item.org.kind)
    return (
      <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        <span>{singular}:</span>
        <Link
          href={orgHref(item.org.kind, item.org.id)}
          className="inline-flex min-h-11 min-w-0 items-center rounded-md font-medium break-words text-foreground underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none md:min-h-0"
        >
          {item.org.name}
        </Link>
        {item.org.archived ? <span>(archived)</span> : null}
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {item.audience
        ? `Across ${orgKindLabels[item.audience].plural.toLowerCase()}`
        : "Across many"}
    </p>
  )
}
