/**
 * Keeping keyboard and screen-reader focus when a status change moves a row.
 *
 * Every task view splits rows into lists (open and done, one per status, only
 * open tasks), so a saved status change can move the row into another list or
 * out of the view. React then removes the focused control and focus falls to
 * <body>. Before saving, `rememberFocus` notes the row; when the change has
 * landed (`settleFocus`) or the row's old copy unmounts (`restoreFocus`), and
 * only if focus was lost, focus goes to the first of these that can take it:
 * 1. the same control on the moved row (found by its data-task-id),
 * 2. the title link of the row that was after it, else the one before it,
 * 3. the list's heading (or the summary of a "Done in the last 7 days" list).
 */

/** Which of a row's controls made the change: the done toggle or the status menu. */
export type StatusControl = "done" | "status"

type PendingFocus = {
  taskId: string
  target: string
  control: StatusControl
  /** Where to look for the moved row: the task views, so hidden pages kept alive don't match. */
  scope: ParentNode
  fallbacks: HTMLElement[]
}

// One at a time: focus can only follow the latest change.
let pendingFocus: PendingFocus | null = null

/** Call when a row's control saves a new status, before the page re-renders. */
export function rememberFocus(
  row: HTMLElement | null,
  taskId: string,
  target: string,
  control: StatusControl,
): void {
  if (!row) return
  pendingFocus = {
    taskId,
    target,
    control,
    scope: row.closest("[data-task-views]") ?? row.ownerDocument,
    fallbacks: fallbacksFor(row),
  }
}

/** The change failed: the row stays where it is, with focus on its control. */
export function forgetFocus(taskId: string): void {
  if (pendingFocus?.taskId === taskId) pendingFocus = null
}

/** A row's status prop changed: if it's the saved change, the row stayed put. */
export function settleFocus(taskId: string, status: string): void {
  if (pendingFocus?.taskId === taskId && pendingFocus.target === status) restoreFocus(taskId)
}

/** Puts focus back if the change left it on <body>. Runs once per change. */
export function restoreFocus(taskId: string): void {
  const pending = pendingFocus
  if (pending?.taskId !== taskId) return
  pendingFocus = null
  const active = document.activeElement
  if (active && active !== document.body) return

  const moved = pending.scope.querySelector<HTMLElement>(
    `[data-task-id="${CSS.escape(taskId)}"] [data-task-control="${pending.control}"]`,
  )
  for (const candidate of [moved, ...pending.fallbacks]) {
    if (!candidate?.isConnected) continue
    // A row moved into a closed <details> can't take focus: try the next one.
    candidate.focus()
    if (document.activeElement === candidate) return
  }
}

function fallbacksFor(row: HTMLElement): HTMLElement[] {
  const titleLink = (el: Element | null) => el?.querySelector<HTMLElement>("[data-task-title]")
  const list = row.closest("section, details")
  const labelledBy = list?.getAttribute("aria-labelledby")
  const heading =
    list instanceof HTMLDetailsElement
      ? list.querySelector<HTMLElement>("summary")
      : labelledBy
        ? row.ownerDocument.getElementById(labelledBy)
        : null
  return [titleLink(row.nextElementSibling), titleLink(row.previousElementSibling), heading].filter(
    (el): el is HTMLElement => el != null,
  )
}
