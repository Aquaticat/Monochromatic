/**
 * Indent and unindent operations for the contenteditable editor.
 *
 * Operates on line div elements, prepending or removing
 * leading whitespace. Returns adjusted cursor/selection coordinates.
 */

import { INDENT_UNIT, } from './text-resolve.ts';

/**
 * Selection range coordinates for indent adjustment.
 */
export type SelectionCoords = {
  /**
   * 0-based start line index.
   */
  readonly startLine: number;
  /**
   * 0-based start character offset.
   */
  readonly startCharacter: number;
  /**
   * 0-based end line index.
   */
  readonly endLine: number;
  /**
   * 0-based end character offset.
   */
  readonly endCharacter: number;
};

/**
 * Result of an indent/unindent operation.
 */
export type IndentResult = {
  /**
   * Whether a selection range should be restored (vs a single cursor).
   */
  readonly isSelection: boolean;
  /**
   * Selection coordinates when `isSelection` is true.
   */
  readonly selection: SelectionCoords;
  /**
   * Cursor coordinates when `isSelection` is false.
   */
  readonly cursor: {
    readonly line: number;
    readonly character: number;
  };
};

/**
 * Indents lines by prepending {@link INDENT_UNIT}.
 *
 * @param editor - contenteditable container element
 *
 * @param cursorLine - current cursor line index
 *
 * @param cursorCharacter - current cursor character offset
 *
 * @param selection - non-collapsed selection, or null for single cursor
 *
 * @returns adjusted cursor/selection coordinates
 *
 * @example
 * ```ts
 * const result = indentLines({ editor: editor, cursorLine: 0, cursorCharacter: 8, selection: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 15 }, });
 * ```
 */
export function indentLines({
  editor,
  cursorLine,
  cursorCharacter,
  selection,
}: {
  readonly editor: HTMLDivElement;
  readonly cursorLine: number;
  readonly cursorCharacter: number;
  readonly selection: SelectionCoords | null;
},): IndentResult {
  /**
   * First line affected by the operation; collapses to the cursor line when no selection exists.
   */
  const startLine = selection !== null ? selection.startLine : cursorLine;
  /**
   * Last line affected by the operation; equals `startLine` for single-cursor mode.
   */
  const endLine = selection !== null ? selection.endLine : cursorLine;

  for (let i = startLine; i <= endLine; i++) {
    /**
     * Editor line `<div>` at index `i`; undefined when the editor was mutated mid-loop.
     */
    const lineDiv = editor.children[i];
    if (lineDiv === undefined)
      continue;
    /**
     * Raw text of the line, including the `\n` placeholder for empty lines.
     */
    const text = lineDiv.textContent;
    lineDiv.textContent = text === '\n' ? INDENT_UNIT : INDENT_UNIT + text;
  }

  if (selection !== null) {
    return {
      isSelection: true,
      selection: {
        startLine: selection.startLine,
        startCharacter: selection.startCharacter
          + INDENT_UNIT
          .length,
        endLine: selection.endLine,
        endCharacter: selection.endCharacter
          + INDENT_UNIT
          .length,
      },
      cursor: {
        line: cursorLine,
        character: cursorCharacter,
      },
    };
  }

  return {
    isSelection: false,
    selection: {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },
    cursor: {
      line: cursorLine,
      character: cursorCharacter + INDENT_UNIT
        .length,
    },
  };
}

/**
 * Unindents lines by removing up to {@link INDENT_UNIT} leading spaces.
 *
 * @param editor - contenteditable container element
 *
 * @param cursorLine - current cursor line index
 *
 * @param cursorCharacter - current cursor character offset
 *
 * @param selection - non-collapsed selection, or null for single cursor
 *
 * @returns adjusted cursor/selection coordinates
 *
 * @example
 * ```ts
 * const result = unindentLines({ editor: editor, cursorLine: 0, cursorCharacter: 8, selection: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 15 }, });
 * ```
 */
export function unindentLines({
  editor,
  cursorLine,
  cursorCharacter,
  selection,
}: {
  readonly editor: HTMLDivElement;
  readonly cursorLine: number;
  readonly cursorCharacter: number;
  readonly selection: SelectionCoords | null;
},): IndentResult {
  /**
   * First line affected by the operation; collapses to the cursor line when no selection exists.
   */
  const startLine = selection !== null ? selection.startLine : cursorLine;
  /**
   * Last line affected by the operation; equals `startLine` for single-cursor mode.
   */
  const endLine = selection !== null ? selection.endLine : cursorLine;

  /**
   * Track spaces removed per line for cursor/selection adjustment.
   */
  const removedPerLine: number[] = [];

  for (let i = startLine; i <= endLine; i++) {
    /**
     * Editor line `<div>` at index `i`; missing when the children list was mutated mid-loop.
     */
    const lineDiv = editor.children[i];
    if (lineDiv === undefined) {
      removedPerLine.push(0,);
      continue;
    }
    /**
     * Raw text of the line, including the `\n` placeholder for empty lines.
     */
    const text = lineDiv.textContent;
    if (text === '\n') {
      removedPerLine.push(0,);
      continue;
    }

    /**
     * Number of leading spaces removed this iteration; 0, 1, or 2 depending on existing indent depth.
     */
    let count = 0;
    if (text.startsWith('  ',))
      count = 2;
    else if (text.startsWith(' ',))
      count = 1;

    if (count > 0) {
      /**
       * Line text after removing leading spaces; collapses to the empty-line placeholder when nothing remains.
       */
      const newText = text.slice(count,);
      lineDiv.textContent = newText === '' ? '\n' : newText;
    }
    removedPerLine.push(count,);
  }

  if (selection !== null) {
    /**
     * Spaces removed from the first selected line; used to shift `selection.startCharacter`.
     */
    const [startRemoved = 0,] = removedPerLine;
    /**
     * Spaces removed from the last selected line; used to shift `selection.endCharacter`.
     */
    const endRemoved = removedPerLine.at(-1,)
      ?? 0;
    return {
      isSelection: true,
      selection: {
        startLine: selection.startLine,
        startCharacter: Math.max(
          0,
          selection.startCharacter
            - startRemoved,
        ),
        endLine: selection.endLine,
        endCharacter: Math.max(
          0,
          selection.endCharacter
            - endRemoved,
        ),
      },
      cursor: {
        line: cursorLine,
        character: cursorCharacter,
      },
    };
  }

  /**
   * Spaces removed from the cursor's line; used to shift `cursorCharacter`.
   */
  const lineRemoved = removedPerLine[0]
    ?? 0;
  return {
    isSelection: false,
    selection: {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },
    cursor: {
      line: cursorLine,
      character: Math.max(
        0,
        cursorCharacter - lineRemoved,
      ),
    },
  };
}
