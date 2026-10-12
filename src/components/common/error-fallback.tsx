"use client"

import { useEffect } from "react"
import Link from "next/link"
import { House, RotateCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ErrorBoundaryProps = {
  error: Error & { digest?: string }
  /** Re-fetches and re-renders the failed segment (Next 16.4; preferred over `reset`). */
  retry: () => void
}

/**
 * Calm "something went wrong" screen for error.tsx boundaries: try again, or
 * go home. Shows the error reference (digest) so it can be matched to the
 * server logs; never the message itself, which may be sensitive.
 */
export function ErrorFallback({
  error,
  retry,
  className,
}: ErrorBoundaryProps & { className?: string }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      role="alert"
      className={cn("mx-auto flex max-w-md flex-col items-center gap-4 text-center", className)}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <TriangleAlert className="size-6" />
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          This page didn&apos;t load. Nothing you saved earlier is lost. Try again in a moment; if
          it keeps happening, tell the team
          {error.digest ? " and include the reference below" : ""}.
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Reference: <code className="font-mono break-all">{error.digest}</code>
          </p>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button type="button" onClick={() => retry()}>
          <RotateCw aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <House aria-hidden />
            Go to This Week
          </Link>
        </Button>
      </div>
    </div>
  )
}
