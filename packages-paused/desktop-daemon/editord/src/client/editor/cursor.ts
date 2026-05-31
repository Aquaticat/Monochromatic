/**
 * Cursor and selection operations for the contenteditable editor.
 *
 * Uses `getComposedRanges` to cross the shadow DOM boundary.
 */

import {
  resolveLineCharacter,
  resolveTextPosition,
} from './text-resolve.ts';

import type { EditorPosition, } from '../position.ts';
import type { SelectionCoords, } from './indent.ts';

/**
 * Resolves a composed `StaticRange` from the current selection.
 *
 * @param shadow - shadow root to cross the boundary
 *
 * @returns the first composed range, or null
 *
 * @example
 * ```ts
 * const range = getComposedRange({ shadow: pane.shadowRoot, });
 * ```
 */
export function getComposedRange(
  { shadow, }: { readonly shadow: ShadowRoot; },
): StaticRange | null {
  /**
   * Document-wide selection object; null when no document is currently focused.
   */
  const selection = document.getSelection();
  if (selection === null)
    return null;
  /**
   * Composed ranges that pierce the shadow root; entry 0 is the active selection range.
   */
  const ranges = selection.getComposedRanges({ shadowRoots: [shadow,], },);
  return ranges[0]
    ?? null;
}

/**
 * Resolves the current editor cursor position.
 *
 * @param editor - contenteditable container element
 *
 * @param shadow - shadow root for composed ranges
 *
 * @returns 0-based line and character, or null
 *
 * @example
 * ```ts
 * const pos = getCursorPosition({ editor: editorEl, shadow: pane.shadowRoot, });
 * ```
 */
export function getCursorPosition({
  editor,
  shadow,
}: {
  readonly editor: HTMLDivElement;
  readonly shadow: ShadowRoot;
},): EditorPosition | null {
  /**
   * Shadow-composed selection range; null when no selection exists.
   */
  const range = getComposedRange({ shadow, },);
  if (range === null)
    return null;
  return resolveLineCharacter({
    editor,
    container: range.startContainer,
    offset: range.startOffset,
  },);
}

/**
 * Returns the bounding rectangle of the editor cursor.
 *
 * @param shadow - shadow root for composed ranges
 *
 * @returns DOMRect of the caret, or null
 *
 * @example
 * ```ts
 * const rect = getCursorRect({ shadow: pane.shadowRoot, });
 * ```
 */
export function getCursorRect({ shadow, }: { readonly shadow: ShadowRoot; },): DOMRect | null {
  /**
   * Shadow-composed selection range; null when no selection exists.
   */
  const sRange = getComposedRange({ shadow, },);
  if (sRange === null)
    return null;
  /**
   * Live `Range` rebuilt from the composed endpoints; required because `getBoundingClientRect` lives on `Range`, not `StaticRange`.
   */
  const range = document.createRange();
  range.setStart(
    sRange.startContainer,
    sRange.startOffset,
  );
  range.setEnd(
    sRange.endContainer,
    sRange.endOffset,
  );
  return range.getBoundingClientRect();
}

/**
 * Places the cursor at the specified line and character position.
 *
 * @param editor - contenteditable container element
 *
 * @param line - 0-based line index
 *
 * @param character - 0-based character offset
 *
 * @example
 * ```ts
 * restoreCursor({ editor: editor, line: 10, character: 5, });
 * ```
 */
export function restoreCursor({
  editor,
  line,
  character,
}: {
  readonly editor: HTMLDivElement;
  readonly line: number;
  readonly character: number;
},): void {
  /**
   * Document-wide selection object; null when no document is focused.
   */
  const selection = document.getSelection();
  if (selection === null)
    return;
  /**
   * Resolved text node and offset for `(line, character)`; null when coordinates fall outside the editor.
   */
  const resolved = resolveTextPosition({
    editor,
    lineIndex: line,
    character,
  },);
  if (resolved === null)
    return;
  selection.setBaseAndExtent(
    resolved.node,
    resolved.offset,
    resolved.node,
    resolved.offset,
  );
}

/**
 * Sets the visual selection to a range.
 *
 * @param editor - contenteditable container element
 *
 * @param coords - selection start and end coordinates
 *
 * @example
 * ```ts
 * setSelection({ editor: editorEl, coords: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 15 }, });
 * ```
 */
export function setSelection({
  editor,
  coords,
}: {
  readonly editor: HTMLDivElement;
  readonly coords: SelectionCoords;
},): void {
  /**
   * Document-wide selection object; null when no document is focused.
   */
  const selection = document.getSelection();
  if (selection === null)
    return;
  /**
   * Anchor endpoint as text-node and offset; null when the start coordinates are out of range.
   */
  const start = resolveTextPosition({
    editor,
    lineIndex: coords.startLine,
    character: coords.startCharacter,
  },);
  /**
   * Focus endpoint as text-node and offset; null when the end coordinates are out of range.
   */
  const end = resolveTextPosition({
    editor,
    lineIndex: coords.endLine,
    character: coords.endCharacter,
  },);
  if ((start === null) || (end === null))
    return;
  selection.setBaseAndExtent(
    start.node,
    start.offset,
    end.node,
    end.offset,
  );
}

/**
 * Reads the current visual selection as 0-based coordinates.
 *
 * @param editor - contenteditable container element
 *
 * @param shadow - shadow root for composed ranges
 *
 * @returns selection coordinates, or null
 *
 * @example
 * ```ts
 * const sel = getSelection({ editor: editorEl, shadow: pane.shadowRoot, });
 * ```
 */
export function getSelection({
  editor,
  shadow,
}: {
  readonly editor: HTMLDivElement;
  readonly shadow: ShadowRoot;
},): SelectionCoords | null {
  /**
   * Shadow-composed selection range; null when no selection exists.
   */
  const range = getComposedRange({ shadow, },);
  if (range === null)
    return null;
  /**
   * Selection start translated to `(line, character)` for the editor's coordinate space.
   */
  const start = resolveLineCharacter({
    editor,
    container: range.startContainer,
    offset: range.startOffset,
  },);
  /**
   * Selection end translated to `(line, character)` for the editor's coordinate space.
   */
  const end = resolveLineCharacter({
    editor,
    container: range.endContainer,
    offset: range.endOffset,
  },);
  if ((start === null) || (end === null))
    return null;
  return {
    startLine: start.line,
    startCharacter: start.character,
    endLine: end.line,
    endCharacter: end.character,
  };
}
