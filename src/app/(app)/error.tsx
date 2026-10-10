"use client"

import { ErrorFallback, type ErrorBoundaryProps } from "@/components/common/error-fallback"

/** Errors in a signed-in page: shown inside the shell, so the navigation still works. */
export default function AppError(props: ErrorBoundaryProps) {
  return <ErrorFallback {...props} className="py-10 md:py-16" />
}
