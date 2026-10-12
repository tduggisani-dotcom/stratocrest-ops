"use client"

import { useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useDraggable } from "@dnd-kit/core"
import { ArrowRightLeft, GripVertical } from "lucide-react"
import { DueDate } from "@/components/common/due-date"
import { PersonChip } from "@/components/common/person-chip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { IsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgHref } from "../links"
import { RatingBadge, StaleMarker } from "../list/cells"
import type { BoardCard, CardDragData } from "./board-logic"
import { NO_DRAG_ATTRIBUTE } from "./board-sensors"

/** Where focus goes after a move: the card's "Move to" button or its drag handle. */
export type FocusControl = "menu" | "handle"

/**
 * One org on the board. On wide screens the whole card can be dragged with a
 * mouse or pen, and its grip handle by keyboard (Space, arrows, Space) or a
 * long press on touch. Every card also has a "Move to" menu, so moving never
 * needs dragging; on phones that's the only way (`draggable` is false).
 */
export function BoardCardItem({
  kind,
  card,
  today,
  closed,
  draggable,
  readOnly,
  onMove,
}: {
  kind: OrgKind
  card: BoardCard
  today: IsoDate
  /** Won or lost: the next-step date is never "overdue". */
  closed: boolean
  draggable: boolean
  readOnly: boolean
  onMove: (card: BoardCard, stage: string, focus: FocusControl) => void
}) {
  const data: CardDragData = { name: card.name, stage: card.stage }
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
    data,
    disabled: !draggable,
  })

  return (
    <li
      ref={setNodeRef}
      data-board-card={card.id}
      data-stage={card.stage}
      // Only with a handle: without one, dnd-kit would start a keyboard drag from
      // Enter on the card's link.
      {...(draggable ? listeners : undefined)}
      className={cn(
        "rounded-lg border bg-card p-3 text-card-foreground shadow-xs",
        draggable && "touch-manipulation md:cursor-grab",
        isDragging && "opacity-40",
      )}
    >
      <CardFace
        card={card}
        today={today}
        closed={closed}
        title={
          <Link
            href={orgHref(kind, card.id)}
            draggable={false}
            className="inline-flex min-h-11 items-center rounded-sm font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 md:min-h-0"
          >
            {card.name}
          </Link>
        }
        before={
          draggable ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              aria-label={`Drag ${card.name}`}
              data-board-control="handle"
              className="-ml-1.5 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
            >
              <GripVertical aria-hidden className="size-4" />
            </button>
          ) : null
        }
        after={
          readOnly ? null : (
            <MoveMenu
              kind={kind}
              name={card.name}
              stage={card.stage}
              onPick={(stage) => onMove(card, stage, "menu")}
            />
          )
        }
      />
    </li>
  )
}

/**
 * What a card shows: name, owner, next step and its date (red when overdue),
 * the latest rating (green only for 4–5) and the amber stale marker. Also the
 * floating copy while a card is dragged (`title` is then plain text).
 */
export function CardFace({
  card,
  today,
  closed,
  title,
  before,
  after,
}: {
  card: BoardCard
  today: IsoDate
  closed: boolean
  title?: ReactNode
  before?: ReactNode
  after?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-start gap-1">
        {before}
        <div className="min-w-0 flex-1 pt-1">
          {title ?? <span className="font-medium break-words">{card.name}</span>}
        </div>
        {after}
      </div>
      {card.nextStep ? (
        <p title={card.nextStep} className="line-clamp-2 text-sm break-words text-muted-foreground">
          {card.nextStep}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <PersonChip person={card.owner} size="sm" className="max-w-full" />
        {card.latestRating !== null ? <RatingBadge rating={card.latestRating} /> : null}
      </div>
      {card.nextStepDate ? <DueDate date={card.nextStepDate} today={today} done={closed} /> : null}
      <StaleMarker org={card} />
    </div>
  )
}

/**
 * "Move to…": the kind's stages, saving only on a pick (arrowing through the
 * list saves nothing). A mouse opens it on press; touch and pen open it on a
 * finished tap, so a scroll that starts on the button doesn't open it (the
 * same pattern as the task status menu).
 */
function MoveMenu({
  kind,
  name,
  stage,
  onPick,
}: {
  kind: OrgKind
  name: string
  stage: string
  onPick: (stage: string) => void
}) {
  const [open, setOpen] = useState(false)
  // The last pointer that pressed the button; a click with none counts as a tap.
  const pointerType = useRef("touch")
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        onPointerDown={(event) => {
          pointerType.current = event.pointerType
          // Cancelling it stops Radix opening the menu (it skips a prevented event).
          if (event.pointerType !== "mouse") event.preventDefault()
        }}
        onClick={(event) => {
          if (pointerType.current === "mouse") return
          event.currentTarget.focus()
          setOpen(true)
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Move to another stage"
          data-board-control="menu"
          {...{ [NO_DRAG_ATTRIBUTE]: "" }}
          className="-my-1 -mr-1.5 text-muted-foreground md:size-8"
        >
          <ArrowRightLeft aria-hidden />
          <span className="sr-only">Move {name} to another stage</span>
        </Button>
      </DropdownMenuTrigger>
      {/* Capped, so a long name wraps instead of pushing the menu off a phone screen. */}
      <DropdownMenuContent align="end" className="max-w-72 min-w-48">
        <DropdownMenuLabel className="text-xs font-normal break-words text-muted-foreground">
          Move {name} to…
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={stage} onValueChange={onPick}>
          {kindConfig(kind).stages.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value} className="min-h-11 md:min-h-8">
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
