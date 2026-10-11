import Link from "next/link"
import { UserRoundXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** /people/<unknown or malformed id>: shown inside the app shell. */
export default function PersonNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center md:py-16">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <UserRoundXIcon className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          We couldn&apos;t find that teammate
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          The link may be old or mistyped. Everyone on the team is on the People page.
        </p>
      </div>
      <Button asChild className="max-sm:w-full">
        <Link href="/people">See everyone</Link>
      </Button>
    </div>
  )
}
