/**
 * Geometric hit-testing for text positions in the editor.
 *
 * Maps mouse coordinates to 0-based line/character positions
 * by walking the shadow root's children geometrically.
 * `document.caretPositionFromPoint` does not penetrate shadow DOM,
 * so these utilities find the line div and character offset
 * under a given point via bounding rect comparison and binary search.
 */

import { findCharAtX, } from './char-from-point.ts';
import type { EditorPosition, } from './position.ts';

/**
 * Resolves a text position from mouse coordinates within the editor.
 *
 * Uses geometric hit-testing against per-line divs since
 * `document.caretPositionFromPoint` does not penetrate shadow DOM.
 * Finds the line by bounding rect comparison, then estimates
 * the character offset using a binary search with Range measurement.
 *
 * @param editor - the contenteditable container element (inside shadow DOM)
 *
 * @param x - horizontal mouse coordinate (client pixels)
 *
 * @param y - vertical mouse coordinate (client pixels)
 *
 * @returns text position, or null if the coordinates are outside text
 *
 * @example
 * ```ts
 * const result = getPositionFromPoint({ editor: editor, x: 120, y: 240, });
 * ```
 */
export function getPositionFromPoint({
  editor,
  x,
  y,
}: {
  editor: HTMLElement;
  x: number;
  y: number;
},): EditorPosition | null {
  const lineResult = findLineAtY({
    editor,
    y,
  },);
  if (lineResult === null)
    return null;

  const character = findCharAtX({
    lineDiv: lineResult.lineDiv,
    x,
  },);
  return {
    line: lineResult.line,
    character,
  };
}

/**
 * Finds the line div whose bounding rect contains the y coordinate.
 * Uses binary search over the vertically-ordered children to avoid
 * O(n) layout recalculations on large files.
 *
 * @returns line index and element, or null if y is outside all lines
 */
function findLineAtY({
  editor,
  y,
}: {
  editor: HTMLElement;
  y: number;
},): {
  line: number;
  lineDiv: Element;
} | null {
  const { children, } = editor;
  let lo = 0;
  let hi = children.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const child = children[mid];
    if (child === undefined)
      return null;
    const rect = child.getBoundingClientRect();

    if (y < rect.top)
      hi = mid - 1;
    else if (y > rect.bottom)
      lo = mid + 1;
    else {
      return {
        line: mid,
        lineDiv: child,
      };
    }
  }

  return null;
}
