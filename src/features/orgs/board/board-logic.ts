import type {
  Announcements,
  KeyboardCoordinateGetter,
  ScreenReaderInstructions,
} from "@dnd-kit/core"
import type { IsoDate } from "@/lib/dates"
import type { OrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import type { OrgListItem } from "../queries/list"

/**
 * The Kanban's pure parts: what a card shows, which columns there are, where
 * each card goes, how an optimistic move changes that, and what the board says
 * to screen readers. No React and no I/O, so it's unit-tested.
 */

export type BoardColumn = {
  stage: string
  label: string
  outcome: "open" | "won" | "lost"
}

/** One org on the board: only what a card shows (the page sends this to the browser). */
export type BoardCard = Pick<
  OrgListItem,
  "is_stale" | "days_since_contact" | "last_contact_date"
> & {
  id: string
  name: string
  stage: string
  owner: { name: string; avatarUrl: string | null }
  nextStep: string | null
  nextStepDate: IsoDate | null
  latestRating: number | null
}

/** A stage change shown before the server confirms it. */
export type BoardMove = { orgId: string; stage: string }

/** What each draggable carries, for announcements and the keyboard. */
export type CardDragData = { name: string; stage: string }
/** What each column carries. */
export type ColumnDropData = { label: string }

/** The board's card for an org_overview row; null for a row missing its basics. */
export function toBoardCard(org: OrgListItem): BoardCard | null {
  if (!org.id || !org.name || !org.stage) return null
  return {
    id: org.id,
    name: org.name,
    stage: org.stage,
    owner: { name: org.owner_name ?? "Unknown", avatarUrl: org.owner_avatar_url },
    nextStep: org.next_step,
    nextStepDate: org.next_step_date,
    latestRating: org.latest_rating,
    is_stale: org.is_stale,
    days_since_contact: org.days_since_contact,
    last_contact_date: org.last_contact_date,
  }
}

/**
 * The columns, in pipeline order: every stage of the kind, or only the
 * stages the stage filter picks (so a filtered board isn't mostly empty).
 */
export function boardColumns(kind: OrgKind, filters: Pick<OrgFilters, "stages">): BoardColumn[] {
  const stages = kindConfig(kind).stages.map(({ value, label, outcome }) => ({
    stage: value,
    label,
    outcome,
  }))
  if (filters.stages.length === 0) return stages
  return stages.filter((column) => filters.stages.includes(column.stage))
}

/**
 * Each column with its cards. Cards keep the list's order (its sort), so a
 * moved card lands where the refreshed list will put it. A card whose stage
 * has no column (moved out of a filtered board) is left out.
 */
export function groupByStage<C extends Pick<BoardCard, "stage">>(
  cards: readonly C[],
  columns: readonly BoardColumn[],
): { column: BoardColumn; cards: C[] }[] {
  const groups = new Map(columns.map((column) => [column.stage, [] as C[]]))
  for (const card of cards) groups.get(card.stage)?.push(card)
  return columns.map((column) => ({ column, cards: groups.get(column.stage) ?? [] }))
}

/** The cards after a move (the reducer behind the optimistic board). */
export function applyMove<C extends Pick<BoardCard, "id" | "stage">>(
  cards: readonly C[],
  move: BoardMove,
): C[] {
  return cards.map((card) => (card.id === move.orgId ? { ...card, stage: move.stage } : card))
}

export function stageLabelOf(columns: readonly Pick<BoardColumn, "stage" | "label">[]) {
  return (stage: string) => columns.find((column) => column.stage === stage)?.label ?? stage
}

const KEY_STEPS: Record<string, -1 | 1> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

/**
 * The column an arrow key moves a picked-up card to: the next or previous
 * column (right/down, left/up), staying put at either end. Null for other keys.
 */
export function columnTarget(order: readonly string[], current: string, code: string) {
  const step = KEY_STEPS[code]
  if (!step) return null
  const index = order.indexOf(current)
  if (index === -1) return order[0] ?? null
  return order[index + step] ?? current
}

/**
 * Keyboard dragging: each arrow press jumps the picked-up card to the next or
 * previous column (dnd-kit's default moves it 25 px at a time). The card's
 * top-left lands just inside the column, so the column is what it's over.
 */
export function columnKeyboardCoordinates(order: readonly string[]): KeyboardCoordinateGetter {
  return (event, { context, currentCoordinates }) => {
    if (!(event.code in KEY_STEPS)) return undefined
    event.preventDefault()
    const data = context.active?.data.current as Partial<CardDragData> | undefined
    const current = String(context.over?.id ?? data?.stage ?? "")
    const target = columnTarget(order, current, event.code)
    const rect = target ? context.droppableRects.get(target) : undefined
    if (!rect) return currentCoordinates
    return { x: rect.left + 8, y: rect.top + 8 }
  }
}

/** What dnd-kit reads to screen readers while a card is dragged, in plain words. */
export function boardAnnouncements(stageLabel: (stage: string) => string): Announcements {
  const card = (active: { data: { current?: unknown } }) => {
    const data = (active.data.current ?? {}) as Partial<CardDragData>
    return { name: data.name ?? "The card", from: stageLabel(data.stage ?? "") }
  }
  const column = (over: { id: string | number; data: { current?: unknown } } | null) =>
    over
      ? ((over.data.current as Partial<ColumnDropData> | undefined)?.label ?? String(over.id))
      : null

  // dnd-kit reports the card "over" its own column the moment it's picked up, and a live
  // region speaks only its latest text: stay quiet until it first leaves, so the pick-up
  // instructions are what a screen reader says.
  let leftHome = false
  return {
    onDragStart({ active }) {
      leftHome = false
      const { name, from } = card(active)
      return `Picked up ${name}, in ${from}. Use the arrow keys to choose another stage, then press Space to drop it, or Escape to cancel.`
    },
    onDragOver({ active, over }) {
      const { name, from } = card(active)
      const target = column(over)
      if (!leftHome && target === from) return undefined
      leftHome = true
      return target ? `${name} is over ${target}.` : `${name} is not over a stage.`
    },
    onDragEnd({ active, over }) {
      const { name, from } = card(active)
      const target = column(over)
      if (!target || target === from) return `Dropped ${name}. It stays in ${from}.`
      return `Dropped ${name} in ${target}.`
    },
    onDragCancel({ active }) {
      const { name, from } = card(active)
      return `Cancelled. ${name} stays in ${from}.`
    },
  }
}

/** Read once when a drag handle gets focus. */
export function boardInstructions(kind: OrgKind): ScreenReaderInstructions {
  const noun = kindConfig(kind).singular.toLowerCase()
  return {
    draggable: `To move this ${noun} to another stage, press Space to pick it up, use the arrow keys to choose a stage, and press Space again to drop it. Press Escape to cancel. The Move to menu does the same without dragging.`,
  }
}
