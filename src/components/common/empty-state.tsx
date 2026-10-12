import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * What a list shows before it has anything in it: what goes here, and (via
 * `action`) a button to add the first item. Every list in the app has one.
 *
 * `titleAs` keeps the heading order right: "h2" directly under a page's h1,
 * "h3" inside a titled card.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = "h2",
  size = "default",
  className,
}: {
  icon?: LucideIcon
  title: string
  description: ReactNode
  action?: ReactNode
  titleAs?: "h2" | "h3"
  size?: "default" | "compact"
  className?: string
}) {
  const compact = size === "compact"
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10 md:py-14",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            compact ? "size-10" : "size-12",
          )}
        >
          <Icon className={compact ? "size-5" : "size-6"} />
        </span>
      ) : null}
      <Title className={cn("font-semibold text-balance", compact ? "text-sm" : "text-base")}>
        {title}
      </Title>
      <div
        className={cn(
          "max-w-prose text-pretty text-muted-foreground",
          compact ? "text-xs leading-relaxed" : "text-sm",
        )}
      >
        {description}
      </div>
      {action ? (
        <div className="mt-2 flex flex-col items-center gap-2 max-md:w-full">{action}</div>
      ) : null}
    </div>
  )
}
