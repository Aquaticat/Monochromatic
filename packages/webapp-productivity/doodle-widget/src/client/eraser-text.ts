/**
 * Text erasure for the doodle widget.
 *
 * Removes entire text input elements when the eraser path touches
 * their bounding rect. Tests both current and previous eraser
 * positions to avoid missing items during fast drags.
 */

import { type NormalizedPoint, denormalizePoint, } from './drawing.ts';

/**
 * Checks whether a pixel coordinate falls inside an input's
 * layer-relative bounding rect.
 *
 * @param px - test point x in pixels
 *
 * @param py - test point y in pixels
 *
 * @param rect - input bounding rect from `getBoundingClientRect()`
 *
 * @param layerRect - text layer bounding rect for offset calculation
 *
 * @returns `true` if the point is inside the rect
 */
function pointInInputRect(
  { px, py, rect, layerRect, }: {
    px: number; py: number;
    rect: DOMRect; layerRect: DOMRect;
  },
): boolean {
  const relLeft = rect.left - layerRect.left;
  const relTop = rect.top - layerRect.top;
  return px >= relLeft
    && px <= relLeft + rect.width
    && py >= relTop
    && py <= relTop + rect.height;
}

/**
 * Erases text items touched by the eraser path.
 *
 * Tests both the current and previous eraser positions against each
 * text input's bounding rect to avoid missing items during fast drags.
 *
 * @param point - current eraser position in normalized [0..1] space
 *
 * @param previousPoint - previous eraser position, or null for first event
 *
 * @param cw - current canvas width in CSS pixels
 *
 * @param ch - current canvas height in CSS pixels
 *
 * @param textLayer - text layer container element
 *
 * @returns `true` if any text was removed
 *
 * @example
 * ```ts
 * const removed = eraseTextAt({
 *   point: [0.3, 0.4], previousPoint: [0.2, 0.3],
 *   cw: 800, ch: 600, textLayer,
 * });
 * ```
 */
export function eraseTextAt({ point, previousPoint, cw, ch, textLayer, }: {
  point: NormalizedPoint;
  previousPoint: NormalizedPoint | null;
  cw: number;
  ch: number;
  textLayer: HTMLDivElement;
}): boolean {
  /** Current eraser position in CSS pixels */
  const { px, py, } = denormalizePoint({ point, cw, ch, },);
  /** Layer bounding rect for converting input rects to layer-relative coords */
  const layerRect = textLayer.getBoundingClientRect();

  const inputs = [...textLayer.querySelectorAll<HTMLInputElement>('.text-input',),];
  let erased = false;

  for (const input of inputs) {
    const rect = input.getBoundingClientRect();

    /** Check current eraser position */
    const hitCurrent = pointInInputRect({ px, py, rect, layerRect, },);

    /** Check previous eraser position when available */
    const hitPrevious = previousPoint !== null
      && pointInInputRect({
        ...denormalizePoint({ point: previousPoint, cw, ch, },),
        rect, layerRect,
      },);

    if (hitCurrent || hitPrevious) {
      input.remove();
      erased = true;
    }
  }

  return erased;
}
