import Link from "next/link"
import { MountainSnow } from "lucide-react"
import { cn } from "@/lib/utils"

/** App name + mark, linking home (This Week). */
export function AppBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-2 rounded-md font-semibold tracking-tight",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <MountainSnow className="size-4" />
      </span>
      <span className="truncate">StratoCrest Ops</span>
    </Link>
  )
}
