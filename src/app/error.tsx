"use client"

import { ErrorFallback, type ErrorBoundaryProps } from "@/components/common/error-fallback"

/** Errors outside the app shell (sign-in pages, or the shell itself). */
export default function RootError(props: ErrorBoundaryProps) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <ErrorFallback {...props} />
    </main>
  )
}
