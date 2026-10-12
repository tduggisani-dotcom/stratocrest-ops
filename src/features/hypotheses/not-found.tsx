import Link from "next/link"
import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { hypothesesHref } from "@/features/orgs/links"

/** /hypotheses/<unknown or malformed id>: shown inside the app shell. */
export function HypothesisNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center md:py-16">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <SearchX className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          We couldn&apos;t find that hypothesis
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          The link may be old or mistyped. Every hypothesis, including archived ones, keeps its own
          page.
        </p>
      </div>
      <Button asChild className="max-sm:w-full">
        <Link href={hypothesesHref()}>See all hypotheses</Link>
      </Button>
    </div>
  )
}
