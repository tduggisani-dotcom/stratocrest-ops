/**
 * Focus helpers for after a save. Next keeps recently visited pages alive
 * but hidden (React <Activity>), so the same selector can match a hidden copy
 * on another page: only an element that is shown counts.
 */

/** The first element matching `selector` that is on the page and shown. */
export function findShown(selector: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (element.isConnected && element.getClientRects().length > 0) return element
  }
  return null
}

/**
 * Moves focus to `selector` once it is shown: after a save, the element (the
 * item just added, or the Restore button that replaces Archive) arrives with
 * the refreshed page a frame or two later. After about half a second it gives
 * up and calls `otherwise`. Returns a function that stops waiting.
 */
export function focusWhenShown(selector: string, otherwise?: () => void): () => void {
  let frames = 30
  let handle = 0
  const attempt = () => {
    const target = findShown(selector)
    if (target) target.focus()
    else if (frames-- > 0) handle = requestAnimationFrame(attempt)
    else otherwise?.()
  }
  attempt()
  return () => cancelAnimationFrame(handle)
}
