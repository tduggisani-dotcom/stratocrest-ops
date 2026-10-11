import type { ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * The building blocks every This Week card shares: the titled card, count
 * badges, sub-lists, item rows and "See all" links. Plain components (no
 * hooks, no server-only imports), so the client error fallback can use them too.
 */

/** Count tones: neutral, or a status colour when the count itself is a status. */
export type CountTone = "neutral" | "overdue" | "stale"

const TONE_CLASSES: Record<CountTone, string> = {
  neutral: "",
  overdue: "bg-overdue-soft text-overdue",
  stale: "bg-stale-soft text-stale",
}

/** A small count next to a heading. `label` is what screen readers hear after the number. */
export function CountBadge({
  count,
  label,
  tone = "neutral",
}: {
  count: number
  label: string
  tone?: CountTone
}) {
  return (
    <Badge variant="secondary" className={cn("tabular-nums", TONE_CLASSES[tone])}>
      {count}
      <span className="sr-only"> {label}</span>
    </Badge>
  )
}

/**
 * One section of the page: a card with an h2 (the region's name), an optional
 * count and description, an optional action on the right, and its content.
 */
export function SectionCard({
  id,
  title,
  icon: Icon,
  count,
  description,
  action,
  children,
  busy,
}: {
  id: string
  title: string
  icon?: LucideIcon
  count?: { value: number; label: string; tone?: CountTone }
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  /** Set while the skeleton shows. */
  busy?: boolean
}) {
  const headingId = `${id}-heading`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-busy={busy || undefined}
      className="flex h-full min-w-0 scroll-mt-20 flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm md:p-5"
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
            {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
            <h2 id={headingId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {count ? (
              <CountBadge count={count.value} label={count.label} tone={count.tone} />
            ) : null}
          </div>
          {description ? (
            <p className="text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="-my-1 shrink-0">{action}</div> : null}
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </section>
  )
}

/**
 * A titled list inside a card (h3 + count + rows + "See all" link). `id`
 * names the list for screen readers.
 */
export function SubList({
  id,
  title,
  count,
  countLabel,
  tone,
  hidden = 0,
  more,
  empty,
  children,
}: {
  id: string
  title: string
  count: number
  countLabel: string
  tone?: CountTone
  /** How many items exist beyond the rows shown ("And 3 more"). */
  hidden?: number
  /** The "See all" link under the rows. */
  more?: ReactNode
  /** One line shown instead of the rows when there are none. */
  empty?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {count > 0 ? <CountBadge count={count} label={countLabel} tone={tone} /> : null}
      </div>
      {count > 0 ? (
        <ul aria-labelledby={id} className="divide-y">
          {children}
        </ul>
      ) : (
        <p className="py-2 text-sm text-pretty text-muted-foreground">{empty}</p>
      )}
      {hidden > 0 ? <MoreCount count={hidden} /> : null}
      {more}
    </div>
  )
}

/**
 * One item: the whole row is a link (≥ 44 px tall), with a title and a meta
 * line (owner, date…) that wraps on phones.
 */
export function ItemRow({
  href,
  title,
  detail,
  children,
}: {
  href: Route
  title: ReactNode
  /** A muted line under the title (e.g. the next action). */
  detail?: ReactNode
  /** The meta line: owner chip, due date, labels. */
  children?: ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-11 min-w-0 flex-col justify-center gap-1 rounded-md px-2 py-2 hover:bg-accent focus-visible:bg-accent"
      >
        <span className="font-medium break-words">{title}</span>
        {detail ? (
          <span className="line-clamp-2 text-sm break-words text-muted-foreground">{detail}</span>
        ) : null}
        {children ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {children}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

/** "And 3 more", under a list that shows only the first few. */
export function MoreCount({ count }: { count: number }) {
  return <p className="pt-1 text-sm text-muted-foreground">And {count} more</p>
}

/** "See all my tasks ›": a text link with a 44 px tap target on phones. */
export function MoreLink({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-9"
    >
      {children}
      <ChevronRight aria-hidden className="size-4" />
    </Link>
  )
}

/** Several "See all" links in a row (e.g. Investors · Customers). */
export function MoreLinks({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-4">{children}</div>
}
