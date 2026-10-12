import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react"
import {
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type PointerSensorOptions,
  type TouchSensorOptions,
} from "@dnd-kit/core"

/**
 * How a drag starts on the board. dnd-kit's sensors, narrowed so that touch
 * and mouse don't fight, and so a drag never starts from a card's "Move to"
 * button (it opens its menu on press).
 */

/** Marks controls a drag must not start from. */
export const NO_DRAG_ATTRIBUTE = "data-no-drag"

/** True when a drag may start where this event happened (not on a "no drag" control). */
export function startsDrag(event: Pick<Event, "target">): boolean {
  const target = event.target
  return !(
    typeof Element !== "undefined" &&
    target instanceof Element &&
    target.closest(`[${NO_DRAG_ATTRIBUTE}]`) !== null
  )
}

/**
 * Mouse and pen: drag after moving 5 px (pass that as the activation
 * constraint), so a click still opens the card's link. Touch is left to
 * BoardTouchSensor, so a swipe scrolls instead of dragging.
 */
export class BoardPointerSensor extends PointerSensor {
  static override activators: typeof PointerSensor.activators = PointerSensor.activators.map(
    ({ eventName, handler }) => ({
      eventName,
      handler: (event: ReactPointerEvent, options: PointerSensorOptions) =>
        event.nativeEvent.pointerType !== "touch" &&
        startsDrag(event.nativeEvent) &&
        handler(event, options),
    }),
  )
}

/** Touch: drag after a long press (pass delay 250 ms, tolerance 5 px; moving first scrolls). */
export class BoardTouchSensor extends TouchSensor {
  static override activators: typeof TouchSensor.activators = TouchSensor.activators.map(
    ({ eventName, handler }) => ({
      eventName,
      handler: (event: ReactTouchEvent, options: TouchSensorOptions) =>
        startsDrag(event.nativeEvent) && handler(event, options),
    }),
  )
}

/** Pointer drops land on the column under the pointer; keyboard drops on the one the card is in. */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const under = pointerWithin(args)
  return under.length > 0 ? under : rectIntersection(args)
}
