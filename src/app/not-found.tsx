import type { Metadata } from "next"
import Link from "next/link"
import { Compass, House } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Page not found" }

/** Unknown URLs, and anything that calls notFound() without a closer not-found.tsx. */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Compass className="size-6" />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
          <p className="text-sm text-pretty text-muted-foreground">
            The link may be old, or the item may have been archived. Everything else is where you
            left it.
          </p>
        </div>
        <Button asChild className="max-sm:w-full">
          <Link href="/">
            <House aria-hidden />
            Go to This Week
          </Link>
        </Button>
      </div>
    </main>
  )
}
