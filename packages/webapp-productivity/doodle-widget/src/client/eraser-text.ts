/**
 * Text erasure for the doodle widget.
 *
 * Removes entire text input elements when the eraser path touches
 * their bounding rect. Tests both current and previous eraser
 * positions to avoid missing items during fast drags.
 */

import { type NormalizedPoint, denormalizePoint, } from './drawing.ts';

/**
 * Checks whether a content-space pixel coordinate falls inside an
 * input's layout bounds.
 *
 * Uses `offsetLeft`/`offsetTop`/`offsetWidth`/`offsetHeight` instead
 * of `getBoundingClientRect()` so that CSS transforms (zoom/pan) on
 * ancestor elements do not affect the comparison.
 *
 * @param px - test point x in content-space pixels
 *
 * @param py - test point y in content-space pixels
 *
 * @param input - text input element to test against
 *
 * @returns `true` if the point is inside the input's layout bounds
 */
function pointInInputRect(
  { px, py, input, }: {
    px: number; py: number;
    input: HTMLInputElement;
  },
): boolean {
  return px >= input.offsetLeft
    && px <= input.offsetLeft + input.offsetWidth
    && py >= input.offsetTop
    && py <= input.offsetTop + input.offsetHeight;
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
  /** Current eraser position in content-space pixels */
  const { px, py, } = denormalizePoint({ point, cw, ch, },);

  const inputs = [...textLayer.querySelectorAll<HTMLInputElement>('.text-input',),];
  let erased = false;

  for (const input of inputs) {
    /** Check current eraser position */
    const hitCurrent = pointInInputRect({ px, py, input, },);

    /** Check previous eraser position when available */
    const hitPrevious = previousPoint !== null
      && pointInInputRect({
        ...denormalizePoint({ point: previousPoint, cw, ch, },),
        input,
      },);

    if (hitCurrent || hitPrevious) {
      input.remove();
      erased = true;
    }
  }

  return erased;
}
