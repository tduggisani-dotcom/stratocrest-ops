"use client"

import {
  useEffect,
  useId,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { CircleCheck, CircleSlash } from "lucide-react"
import { toast } from "sonner"
import { CountBadge } from "@/features/this-week/components/section-card"
import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import { changeOrgStage } from "../stage-actions"
import type { OrgActionResult } from "../types"
import { BoardCardItem, CardFace, type FocusControl } from "./board-card"
import {
  applyMove,
  boardAnnouncements,
  boardInstructions,
  columnKeyboardCoordinates,
  groupByStage,
  stageLabelOf,
  type BoardCard,
  type BoardColumn,
  type BoardMove,
  type ColumnDropData,
} from "./board-logic"
import { BoardPointerSensor, BoardTouchSensor, boardCollisionDetection } from "./board-sensors"

const connectionFailed: OrgActionResult = { status: "error", message: CONNECTION_ERROR }

/** Columns sit side by side (and cards can be dragged) from Tailwind's `md` up. */
const WIDE_SCREEN = "(min-width: 48rem)"

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True on wide screens; false on the server and on phones (no dragging there). */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_SCREEN).matches,
    () => false,
  )
}

/**
 * The board itself (see OrgBoard). A move shows at once (useOptimistic); the
 * Server Action saves it and refreshes the page. A toast confirms it ("Moved
 * to Diligence", announced to screen readers) with Undo, or explains a
 * failure, and the card snaps back. After a move from the menu or the
 * keyboard, focus follows the card to its new column.
 */
export function BoardView({
  kind,
  cards,
  columns,
  today,
  readOnly,
}: {
  kind: OrgKind
  cards: BoardCard[]
  columns: BoardColumn[]
  today: IsoDate
  readOnly: boolean
}) {
  const config = kindConfig(kind)
  const stageLabel = stageLabelOf(config.stages.map((s) => ({ stage: s.value, label: s.label })))
  const outcomeOf = (stage: string) =>
    config.stages.find((s) => s.value === stage)?.outcome ?? "open"

  const [shown, addMove] = useOptimistic(cards, (state: BoardCard[], change: BoardMove) =>
    applyMove(state, change),
  )
  const [, startMove] = useTransition()
  const draggable = useWideScreen() && !readOnly
  const [activeId, setActiveId] = useState<string | null>(null)
  const dndId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const focusRequest = useRef<{ orgId: string; stage: string; control: FocusControl } | null>(null)

  const order = columns.map((column) => column.stage).join(",")
  const keyboardOptions = useMemo(
    () => ({ coordinateGetter: columnKeyboardCoordinates(order.split(",")) }),
    [order],
  )
  const sensors = useSensors(
    useSensor(BoardPointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(BoardTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, keyboardOptions),
  )

  // A moved card remounts in its new column: put focus back on the control
  // that moved it. Kept until the card shows up there (or the move fails).
  useEffect(() => {
    const request = focusRequest.current
    if (!request) return
    const card = rootRef.current?.querySelector<HTMLElement>(
      `[data-board-card="${CSS.escape(request.orgId)}"]`,
    )
    if (!card || card.dataset.stage !== request.stage) return
    focusRequest.current = null
    const control =
      card.querySelector<HTMLElement>(`[data-board-control="${request.control}"]`) ??
      card.querySelector<HTMLElement>('[data-board-control="menu"]')
    control?.focus()
  })

  function move(card: BoardCard, stage: string, focus: FocusControl | null) {
    if (card.stage === stage) return
    const previous = card.stage
    focusRequest.current = focus ? { orgId: card.id, stage, control: focus } : null
    startMove(async () => {
      addMove({ orgId: card.id, stage })
      const result = await callAction(() => changeOrgStage(card.id, stage), connectionFailed)
      if (result.status === "error") {
        // The card snaps back to its column; focus goes with it.
        if (focus) focusRequest.current = { orgId: card.id, stage: previous, control: focus }
        toast.error(result.message, { description: card.name })
        return
      }
      toast.success(`Moved to ${stageLabel(stage)}`, {
        description: card.name,
        action: { label: "Undo", onClick: () => undo(card, previous) },
      })
    })
  }

  /** The toast's Undo: moves the card back (it may have moved on since; the server decides). */
  function undo(card: BoardCard, previous: string) {
    startMove(async () => {
      addMove({ orgId: card.id, stage: previous })
      const result = await callAction(() => changeOrgStage(card.id, previous), connectionFailed)
      if (result.status === "error") toast.error(result.message, { description: card.name })
      else toast.success(`Back to ${stageLabel(previous)}`, { description: card.name })
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const card = shown.find((c) => c.id === event.active.id)
    if (!card || !event.over) return
    const byKeyboard = event.activatorEvent instanceof KeyboardEvent
    move(card, String(event.over.id), byKeyboard ? "handle" : null)
  }

  const groups = groupByStage(shown, columns)
  const active = activeId ? shown.find((c) => c.id === activeId) : undefined

  return (
    <div ref={rootRef}>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        accessibility={{
          announcements: boardAnnouncements(stageLabel),
          screenReaderInstructions: boardInstructions(kind),
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Phones: columns stacked. Wider: side by side, scrolling inside the board. */}
        <div className="md:relative md:-mx-1 md:overflow-x-auto md:px-1 md:pb-3">
          <div className="flex flex-col gap-4 md:w-max md:flex-row md:items-start md:gap-3">
            {groups.map(({ column, cards: columnCards }) => (
              <BoardColumnSection
                key={column.stage}
                kind={kind}
                column={column}
                count={columnCards.length}
                droppable={draggable}
              >
                {columnCards.map((card) => (
                  <BoardCardItem
                    key={card.id}
                    kind={kind}
                    card={card}
                    today={today}
                    closed={outcomeOf(card.stage) !== "open"}
                    draggable={draggable}
                    readOnly={readOnly}
                    onMove={move}
                  />
                ))}
              </BoardColumnSection>
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-64 cursor-grabbing rounded-lg border bg-card p-3 text-card-foreground shadow-lg">
              <CardFace card={active} today={today} closed={outcomeOf(active.stage) !== "open"} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

/**
 * One stage: its name and count, then its cards. The won and lost columns
 * stay calm (a small icon, no coloured background). While a card is dragged
 * over it, it's outlined in the accent colour.
 */
function BoardColumnSection({
  kind,
  column,
  count,
  droppable,
  children,
}: {
  kind: OrgKind
  column: BoardColumn
  count: number
  droppable: boolean
  children: React.ReactNode
}) {
  const data: ColumnDropData = { label: column.label }
  const { setNodeRef, isOver } = useDroppable({ id: column.stage, data, disabled: !droppable })
  const headingId = useId()
  const config = kindConfig(kind)
  const Icon =
    column.outcome === "won" ? CircleCheck : column.outcome === "lost" ? CircleSlash : null

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      data-board-column={column.stage}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition-colors md:w-64 md:shrink-0",
        isOver && "border-primary bg-primary/5 ring-2 ring-primary/40",
      )}
    >
      <header className="flex min-h-8 items-center gap-2 px-1">
        {Icon ? (
          <Icon
            aria-hidden
            className={cn(
              "size-4 shrink-0",
              column.outcome === "won" ? "text-good" : "text-muted-foreground",
            )}
          />
        ) : null}
        <h3 id={headingId} className="min-w-0 truncate text-sm font-semibold">
          {column.label}
        </h3>
        <CountBadge
          count={count}
          label={count === 1 ? config.singular.toLowerCase() : config.plural.toLowerCase()}
        />
      </header>
      {count > 0 ? (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {children}
        </ul>
      ) : (
        <p className="px-1 py-4 text-center text-sm text-muted-foreground md:py-8">Nothing here</p>
      )}
    </section>
  )
}
