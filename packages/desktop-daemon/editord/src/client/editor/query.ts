/**
 * Read-only query functions for the editor container element.
 *
 * Extracted from `editor-pane.ts` to keep the class under max-lines.
 * These functions provide focused access to editor state without
 * exposing the underlying DOM element.
 *
 * The structural equality functions (`diagnosticsEqual`, `hintsEqual`)
 * live here because they are read-only queries over protocol types,
 * the same category as `computeDocumentRange`. Keeping them in the
 * same file that `editor-pane.ts` already imports avoids adding a
 * new import line, which matters because editor-pane.ts sits exactly
 * at the 300-code-line limit.
 */

import type {
  Diagnostic,
  InlayHint,
  Range,
} from '../../../protocol.ts';

//region Document range

/**
 * Computes a Range covering the entire document inside the editor.
 * Uses the editor's child div count and last line text length
 * to determine the end position.
 *
 * @param editor - the contenteditable container element
 *
 * @returns document range from (0,0) to end-of-file
 *
 * @example
 * ```ts
 * const result = computeDocumentRange({ editor: editor, });
 * ```
 */
export function computeDocumentRange({ editor, }: { editor: HTMLDivElement; },): Range {
  const lastLineIndex = Math.max(
    0,
    editor.children.length - 1,
  );
  const lastLineEl = editor.children[lastLineIndex];
  const lastLineText = lastLineEl?.textContent ?? '';
  const lastLineLength = lastLineText === '\n' ? 0 : lastLineText.length;
  return {
    start: {
      line: 0,
      character: 0,
    },
    end: {
      line: lastLineIndex,
      character: lastLineLength,
    },
  };
}

//endregion Document range

//region Structural equality

/**
 * Compares two diagnostic arrays by value without JSON serialization.
 * Short-circuits on the first mismatch for O(1) best-case performance.
 *
 * Previously `setDiagnostics` and `setInlayHints` in editor-pane.ts
 * used `JSON.stringify(a) === JSON.stringify(b)` for deep equality.
 * That serialises every field of every element into a temporary string
 * on **every** LSP push; even when nothing changed. For a file with
 * hundreds of diagnostics the stringify alone can take milliseconds,
 * blocking the main thread on the hot path. Field-level comparison
 * bails on the first mismatch (commonly the array length), making
 * the no-change case effectively O(1).
 *
 * @param a - first diagnostic array
 *
 * @param b - second diagnostic array
 *
 * @returns whether the arrays are structurally equal
 *
 * @example
 * ```ts
 * const result = diagnosticsEqual({ a: [], b: [], });
 * ```
 */
export function diagnosticsEqual({
  a,
  b,
}: {
  a: Diagnostic[];
  b: Diagnostic[];
},): boolean {
  if (a.length !== b.length)
    return false;
  return a.every(function matchDiagnostic(
    da,
    i,
  ) {
    const db = b[i];
    if (db === undefined)
      return false;
    return da.message === db.message
      && da.severity === db.severity
      && da.source === db.source
      && da.range.start.line === db.range.start.line
      && da.range.start.character === db.range.start.character
      && da.range.end.line === db.range.end.line
      && da.range.end.character === db.range.end.character;
  },);
}

/**
 * Compares two inlay hint arrays by value without JSON serialization.
 * Short-circuits on the first mismatch for O(1) best-case performance.
 * See {@link diagnosticsEqual} for the motivation behind avoiding
 * `JSON.stringify`.
 *
 * @param a - first inlay hint array
 *
 * @param b - second inlay hint array
 *
 * @returns whether the arrays are structurally equal
 *
 * @example
 * ```ts
 * const result = hintsEqual({ a: [], b: [], });
 * ```
 */
export function hintsEqual({
  a,
  b,
}: {
  a: InlayHint[];
  b: InlayHint[];
},): boolean {
  if (a.length !== b.length)
    return false;
  return a.every(function matchHint(
    ha,
    i,
  ) {
    const hb = b[i];
    if (hb === undefined)
      return false;
    return ha.label === hb.label
      && ha.kind === hb.kind
      && ha.position.line === hb.position.line
      && ha.position.character === hb.position.character
      && ha.paddingLeft === hb.paddingLeft
      && ha.paddingRight === hb.paddingRight;
  },);
}

//endregion Structural equality
