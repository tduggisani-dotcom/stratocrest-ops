import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * One titled part of a profile ("What they own", "When they're busy"…). The
 * heading can take focus (tabIndex -1), so actions that remove the focused
 * control can return focus here.
 */
export function ProfileSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = `${id}-heading`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-20 space-y-4", className)}
    >
      <div className="space-y-1">
        <h2
          id={headingId}
          tabIndex={-1}
          className="text-lg font-semibold tracking-tight focus-visible:outline-offset-4"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** A sub-list heading inside a section, with an optional count. */
export function SubHeading({
  id,
  children,
  count,
}: {
  id?: string
  children: ReactNode
  count?: number
}) {
  return (
    <h3 id={id} className="flex items-baseline gap-2 text-sm font-semibold">
      {children}
      {count !== undefined && count > 0 ? (
        <span className="font-normal text-muted-foreground tabular-nums">({count})</span>
      ) : null}
    </h3>
  )
}

/**
 * The empty state of a short list inside a section: one line saying what goes
 * here, and a link or button to add the first item.
 */
export function EmptyLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-pretty text-muted-foreground">{children}</p>
      {action ? <div className="shrink-0 max-sm:[&>*]:w-full">{action}</div> : null}
    </div>
  )
}
