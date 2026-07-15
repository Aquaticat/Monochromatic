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
export function computeDocumentRange({ editor, }: { readonly editor: HTMLDivElement; },): Range {
  /**
   * Zero-based index of the final line; clamped to 0 when the editor has no children.
   */
  const lastLineIndex = Math.max(
    0,
    editor.children
      .length
      - 1,
  );
  /**
   * DOM element representing the final line; used to measure its trailing length.
   */
  const lastLineEl = editor.children[lastLineIndex];
  /**
   * Text content of the final line, defaulting to `''` when the element is missing.
   */
  const lastLineText = lastLineEl?.textContent
    ?? '';
  /**
   * Effective length of the final line; lone newlines render as length 0 to match document semantics.
   */
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
  readonly a: readonly Diagnostic[];
  readonly b: readonly Diagnostic[];
},): boolean {
  if (a.length
    !== b
    .length)
    return false;
  return a.every(function matchDiagnostic(
    da,
    i,
  ) {
    /**
     * Counterpart diagnostic from the second array at the same index; missing index implies mismatched length.
     */
    const db = b[i];
    if (db === undefined)
      return false;
    return (da.message
      === db
      .message)
      && (da.severity
        === db
        .severity)
      && (da.source
        === db
        .source)
      && (da.range
        .start
        .line
        === db
        .range
        .start
        .line)
      && (da.range
        .start
        .character
        === db
        .range
        .start
        .character)
      && (da.range
        .end
        .line
        === db
        .range
        .end
        .line)
      && (da.range
        .end
        .character
        === db
        .range
        .end
        .character);
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
  readonly a: readonly InlayHint[];
  readonly b: readonly InlayHint[];
},): boolean {
  if (a.length
    !== b
    .length)
    return false;
  return a.every(function matchHint(
    ha,
    i,
  ) {
    /**
     * Counterpart inlay hint from the second array at the same index; missing index implies mismatched length.
     */
    const hb = b[i];
    if (hb === undefined)
      return false;
    return (ha.label
      === hb
      .label)
      && (ha.kind
        === hb
        .kind)
      && (ha.position
        .line
        === hb
        .position
        .line)
      && (ha.position
        .character
        === hb
        .position
        .character)
      && (ha.paddingLeft
        === hb
        .paddingLeft)
      && (ha.paddingRight
        === hb
        .paddingRight);
  },);
}

//endregion Structural equality
