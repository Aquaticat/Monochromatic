/**
 * Editing command functions for `EditorPane`.
 *
 * Extracted from the class to keep `editor-pane.ts` under the max-lines limit.
 * Each function operates on the pane through its public API, avoiding
 * direct access to private fields.
 *
 * Callers (app.ts, keybinding system) invoke these `perform*` functions
 * directly with `{ pane: editorPane }` rather than calling wrapper
 * methods on the class. This avoids seven one-line delegation methods
 * on `EditorPane` that did nothing but forward `{ pane: this }`;
 * keeping them would push editor-pane.ts over the 300-code-line limit
 * and make the class a God-object facade for operations that already
 * live in this file.
 */

import type { EditorPosition, } from '../position.ts';
import { selectAndCopyLine, } from './copy-line.ts';
import { getComposedRange, } from './cursor.ts';
import {
  indentLines as doIndent,
  type SelectionCoords,
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
 *
 * `shadowRoot` was added so `performSelectAndCopy` can resolve the
 * composed selection range internally via `getComposedRange`, rather
 * than requiring the caller to pass it in. This removed the last
 * reason `EditorPane` needed a `selectAndCopyCurrentLine` wrapper
 * that reached into `this.#shadow`.
 */
type PaneApi = {
  /**
   * Returns the contenteditable container, or null before connected.
   */
  readonly getEditorElement: () => HTMLDivElement | null;
  /**
   * Returns the current caret position, or null.
   */
  readonly getCursorPosition: () => EditorPosition | null;
  /**
   * Places the caret at the specified position.
   */
  readonly restoreCursor: (pos: {
    readonly line: number;
    readonly character: number;
  },) => void;
  /**
   * Returns selection coordinates, or null.
   */
  readonly getSelection: () => SelectionCoords | null;
  /**
   * Sets the editor selection.
   */
  readonly setSelection: (coords: SelectionCoords,) => void;
  /**
   * Triggers deferred syntax highlighting.
   */
  readonly requestHighlight: () => void;
  /**
   * Shadow root for composed range resolution.
   */
  readonly shadowRoot: ShadowRoot | null;
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
  readonly pane: PaneApi;
  readonly fn: (opts: {
    readonly editor: HTMLDivElement;
    readonly line: number;
    readonly character: number;
  },) => {
    readonly line: number;
    readonly character: number;
  } | null;
},): void {
  /**
   * Contenteditable container; null when the pane has not been connected yet.
   */
  const editor = pane.getEditorElement();
  if (editor === null)
    return;
  /**
   * Current caret position; null when no selection is active in the editor.
   */
  const pos = pane.getCursorPosition();
  if (pos === null)
    return;
  /**
   * New caret position returned by the operation, or null when the caret should not move.
   */
  const result = fn({
    editor,
    ...pos,
  },);
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
  readonly pane: PaneApi;
  readonly fn: typeof doIndent;
},): void {
  /**
   * Contenteditable container; null when the pane has not been connected yet.
   */
  const editor = pane.getEditorElement();
  if (editor === null)
    return;
  /**
   * Current caret position; null when no selection is active.
   */
  const pos = pane.getCursorPosition();
  if (pos === null)
    return;
  /**
   * Raw selection bounds, including collapsed cases that the indent op should ignore.
   */
  const sel = pane.getSelection();
  /**
   * Same selection narrowed to multi-position ranges; null when the selection is collapsed.
   */
  const nonCollapsed = (sel !== null)
      && (!((sel.startLine
        === sel
        .endLine) && (sel.startCharacter
          === sel
          .endCharacter)))
    ? sel
    : null;
  /**
   * Outcome of the indent/unindent run, expressed as either an updated selection or a new caret.
   */
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

/**
 * Deletes the line at the current cursor position.
 *
 * @example
 * ```ts
 * performDeleteLine({ pane, });
 * ```
 */
export function performDeleteLine({ pane, }: { readonly pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: deleteLineAt,
  },);
}

/**
 * Duplicates the current line below.
 *
 * @example
 * ```ts
 * performDuplicateLine({ pane, });
 * ```
 */
export function performDuplicateLine({ pane, }: { readonly pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: duplicateLineAt,
  },);
}

/**
 * Swaps the current line with the next line.
 *
 * @example
 * ```ts
 * performSwapDown({ pane, });
 * ```
 */
export function performSwapDown({ pane, }: { readonly pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: doSwapDown,
  },);
}

/**
 * Swaps the current line with the previous line.
 *
 * @example
 * ```ts
 * performSwapUp({ pane, });
 * ```
 */
export function performSwapUp({ pane, }: { readonly pane: PaneApi; },): void {
  performLineOp({
    pane,
    fn: doSwapUp,
  },);
}

/**
 * Selects and copies the current line when no text is selected.
 * Resolves the composed range from the pane's shadow root internally.
 *
 * @param pane - editor pane instance
 *
 * @returns true if the line was copied
 *
 * @example
 * ```ts
 * const result = performSelectAndCopy({ pane: pane, });
 * ```
 */
export function performSelectAndCopy({ pane, }: { readonly pane: PaneApi; },): boolean {
  /**
   * Contenteditable container; bail when the pane is not connected or its shadow is detached.
   */
  const editor = pane.getEditorElement();
  if ((editor === null) || (pane.shadowRoot
    === null))
    return false;
  /**
   * Caret position needed to identify which line should be copied.
   */
  const pos = pane.getCursorPosition();
  /**
   * Composed selection range resolved through the shadow root; null when no caret is set.
   */
  const composedRange = getComposedRange({ shadow: pane.shadowRoot, },);
  if ((composedRange === null) || (pos === null))
    return false;
  return selectAndCopyLine({
    editor,
    line: pos.line,
    composedRange,
  },);
}

/**
 * Indents the current line or selected lines.
 *
 * @example
 * ```ts
 * performIndent({ pane, });
 * ```
 */
export function performIndent({ pane, }: { readonly pane: PaneApi; },): void {
  performIndentOp({
    pane,
    fn: doIndent,
  },);
}

/**
 * Unindents the current line or selected lines.
 *
 * @example
 * ```ts
 * performUnindent({ pane, });
 * ```
 */
export function performUnindent({ pane, }: { readonly pane: PaneApi; },): void {
  performIndentOp({
    pane,
    fn: doUnindent,
  },);
}

//endregion Exported commands
