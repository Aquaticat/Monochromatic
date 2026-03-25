/**
 * Editing command functions for `EditorPane`.
 *
 * Extracted from the class to keep `editor-pane.ts` under the max-lines limit.
 * Each function operates on the pane through its public API, avoiding
 * direct access to private fields.
 */

import type { EditorPosition, } from '../position.ts';
import { selectAndCopyLine, } from './copy-line.ts';
import {
  type SelectionCoords,
  indentLines as doIndent,
  unindentLines as doUnindent,
} from './indent.ts';
import {
  deleteLineAt,
  duplicateLineAt,
  swapLineDown as doSwapDown,
  swapLineUp as doSwapUp,
} from './line-ops.ts';

//region Pane API type

/**
 * Subset of EditorPane's public API used by command functions.
 * Defined locally to avoid circular imports with the class module.
 */
type PaneApi = {
  /** Returns the contenteditable container, or null before connected. */
  getEditorElement(): HTMLDivElement | null;
  /** Returns the current caret position, or null. */
  getCursorPosition(): EditorPosition | null;
  /** Places the caret at the specified position. */
  restoreCursor(pos: {
    line: number;
    character: number;
  },): void;
  /** Returns selection coordinates, or null. */
  getSelection(): SelectionCoords | null;
  /** Sets the editor selection. */
  setSelection(coords: SelectionCoords,): void;
  /** Triggers deferred syntax highlighting. */
  requestHighlight(): void;
};

//endregion Pane API type

//region Internal helpers

/**
 * Runs a line-level editing operation that needs cursor state.
 *
 * @param pane - editor pane instance
 *
 * @param fn - operation receiving the editor element and cursor position,
 *   returning the new cursor position or null if unchanged
 */
function performLineOp({
  pane,
  fn,
}: {
  pane: PaneApi;
  fn: (
    editor: HTMLDivElement,
    pos: {
      line: number;
      character: number;
    },
  ) => {
    line: number;
    character: number;
  } | null;
},): void {
  const editor = pane.getEditorElement();
  if (editor === null)
    return;
  const pos = pane.getCursorPosition();
  if (pos === null)
    return;
  const result = fn(
    editor,
    pos,
  );
  if (result !== null)
    pane.restoreCursor(result,);
  pane.requestHighlight();
}

/**
 * Runs an indent/unindent operation with selection awareness.
 *
 * @param pane - editor pane instance
 *
 * @param fn - indent or unindent function to apply
 */
function performIndentOp({
  pane,
  fn,
}: {
  pane: PaneApi;
  fn: typeof doIndent;
},): void {
  const editor = pane.getEditorElement();
  if (editor === null)
    return;
  const pos = pane.getCursorPosition();
  if (pos === null)
    return;
  const sel = pane.getSelection();
  const nonCollapsed = sel !== null
      && !(sel.startLine === sel.endLine && sel.startCharacter === sel.endCharacter)
    ? sel
    : null;
  const result = fn({
    editor,
    cursorLine: pos.line,
    cursorCharacter: pos.character,
    selection: nonCollapsed,
  },);
  if (result.isSelection)
    pane.setSelection(result.selection,);
  else
    pane.restoreCursor(result.cursor,);
  pane.requestHighlight();
}

//endregion Internal helpers

//region Exported commands

/** Deletes the line at the current cursor position. */
export function performDeleteLine({ pane, }: { pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: function op(
      e,
      p,
    ) {
      return deleteLineAt({
        editor: e,
        ...p,
      },);
    },
  },);
}

/** Duplicates the current line below. */
export function performDuplicateLine({ pane, }: { pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: function op(
      e,
      p,
    ) {
      return duplicateLineAt({
        editor: e,
        ...p,
      },);
    },
  },);
}

/** Swaps the current line with the next line. */
export function performSwapDown({ pane, }: { pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: function op(
      e,
      p,
    ) {
      return doSwapDown({
        editor: e,
        ...p,
      },);
    },
  },);
}

/** Swaps the current line with the previous line. */
export function performSwapUp({ pane, }: { pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: function op(
      e,
      p,
    ) {
      return doSwapUp({
        editor: e,
        ...p,
      },);
    },
  },);
}

/**
 * Selects and copies the current line when no text is selected.
 *
 * @param pane - editor pane instance
 *
 * @param composedRange - composed selection range from the shadow root
 *
 * @returns true if the line was copied
 */
export function performSelectAndCopy({
  pane,
  composedRange,
}: {
  pane: PaneApi;
  composedRange: StaticRange | null;
},): boolean {
  const editor = pane.getEditorElement();
  if (editor === null)
    return false;
  const pos = pane.getCursorPosition();
  if (composedRange === null || pos === null)
    return false;
  return selectAndCopyLine({
    editor,
    line: pos.line,
    composedRange,
  },);
}

/** Indents the current line or selected lines. */
export function performIndent({ pane, }: { pane: PaneApi; },): void {
  performIndentOp({
    pane,
    fn: doIndent,
  },);
}

/** Unindents the current line or selected lines. */
export function performUnindent({ pane, }: { pane: PaneApi; },): void {
  performIndentOp({
    pane,
    fn: doUnindent,
  },);
}

//endregion Exported commands
