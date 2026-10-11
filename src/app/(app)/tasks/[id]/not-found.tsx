import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

/** /tasks/<unknown or malformed id>: shown inside the app shell. Archived tasks still open. */
export default function TaskNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center md:py-16">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <SearchX className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that task</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          The link may be old or mistyped. Every task, including archived ones, keeps its own page.
        </p>
      </div>
      <Button asChild className="max-sm:w-full">
        <Link href="/tasks">See all tasks</Link>
      </Button>
    </div>
  )
}
