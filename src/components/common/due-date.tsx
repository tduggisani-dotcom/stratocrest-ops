import { daysBetween, formatDate, relativeDay, type IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

/**
 * A due date with how far away it is. Overdue is red (the only status colours
 * are red / amber / green). Pass `today` from the server (app.today_et / todayEt())
 * so rendering stays pure under Cache Components.
 */
export function DueDate({
  date,
  today,
  done = false,
  className,
}: {
  date: IsoDate
  today: IsoDate
  done?: boolean
  className?: string
}) {
  const diff = daysBetween(today, date)
  const overdue = !done && diff < 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm whitespace-nowrap",
        overdue ? "font-medium text-overdue" : "text-muted-foreground",
        className,
      )}
    >
      <time dateTime={date}>{formatDate(date, "short")}</time>
      <span aria-hidden="true">·</span>
      <span>{overdue ? `overdue ${relativeDay(date, today)}` : relativeDay(date, today)}</span>
    </span>
  )
}
