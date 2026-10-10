import type { ReactNode } from "react"
import { MountainSnow } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The calm, centered frame around /sign-in and /auth/confirm: app name, one
 * line on what it is, then the step's card. Static, so it's part of the
 * instant shell while the card streams in.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <MountainSnow className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">StratoCrest Ops</h1>
            <p className="text-sm text-muted-foreground">
              The StratoCrest team&apos;s private operations app.
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  )
}

/** Placeholder card while the form streams in. */
export function AuthCardSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-11 w-full md:h-9" />
        <Skeleton className="h-11 w-full md:h-9" />
        <span className="sr-only">Loading…</span>
      </CardContent>
    </Card>
  )
}
