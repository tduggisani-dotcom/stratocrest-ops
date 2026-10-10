/** First focusable element on every signed-in page: jumps past the navigation. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-background px-4 py-3 text-sm font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:outline-2 focus:outline-ring"
    >
      Skip to content
    </a>
  )
}
