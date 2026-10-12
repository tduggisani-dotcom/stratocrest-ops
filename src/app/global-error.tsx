"use client"

import { ErrorFallback, type ErrorBoundaryProps } from "@/components/common/error-fallback"
import { ThemeScript } from "@/components/theme/theme-script"
import "./globals.css"

/**
 * Last-resort boundary for errors in the root layout. It replaces the whole
 * document, so it brings its own <html>, styles, and theme.
 */
export default function GlobalError(props: ErrorBoundaryProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong · StratoCrest Ops</title>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
          <ErrorFallback {...props} />
        </main>
      </body>
    </html>
  )
}
