/**
 * Utility functions for the syntax highlighting engine.
 *
 * Extracts line texts from editor DOM, resolves line indices
 * from character offsets, and manages highlight group cleanup.
 */

import { FILE_SIZE_WARNING_THRESHOLD, } from '../../constants.ts';
import { HIGHLIGHT_GROUPS, } from './tags.ts';

/**
 * Maximum file size in bytes for syntax highlighting.
 */
export const MAX_HIGHLIGHT_BYTES: number = FILE_SIZE_WARNING_THRESHOLD;

/**
 * Extracts line texts from the editor's child divs.
 * Empty lines (stored as `\n` in the DOM) are returned as empty strings
 * to match the original file content for accurate offset mapping.
 *
 * @param editor - contenteditable container div
 *
 * @returns array of line text strings
 *
 * @example
 * ```ts
 * const result = getLineTexts({ editor: editor, });
 * ```
 */
export function getLineTexts({ editor, }: { readonly editor: HTMLDivElement; },): string[] {
  return [...editor.children,].map(function readLine(div,) {
    /**
     * Defensive default keeps empty divs producing the empty string rather than null.
     */
    const text = div.textContent
      ?? '';
    return text === '\n' ? '' : text;
  },);
}

/**
 * Finds the line index containing a given text offset via binary search.
 *
 * `lineStarts` is sorted by definition (cumulative offsets), so binary search
 * reduces per-token lookup from O(L) to O(log L), significant when the
 * highlight engine calls this for every token in the parse tree.
 *
 * @param offset - character offset in the full text
 *
 * @param lineStarts - cumulative byte offset at the start of each line (sorted ascending)
 *
 * @returns zero-based line index
 *
 * @example
 * ```ts
 * const result = findLineForOffset({ offset: 42, lineStarts: [0, 25, 48, 72], });
 * ```
 */
export function findLineForOffset({
  offset,
  lineStarts,
}: {
  readonly offset: number;
  readonly lineStarts: readonly number[];
},): number {
  /**
   * Binary-search lower bound; mutated as the search narrows.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- binary-search state machine: `lo` rises when `mid` overshoots
  let lo = 0;
  /**
   * Binary-search upper bound; ends one before length so out-of-range returns last.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- binary-search state machine: `hi` falls when `mid` undershoots
  let hi = lineStarts.length
    - 1;
  while (lo <= hi) {
    /**
     * Unsigned right shift halves without overflowing for very long files.
     */
    const mid = (lo + hi) >>> 1;
    /**
     * Cumulative offset at the candidate line; undefined breaks the loop.
     */
    const start = lineStarts[mid];
    if (start === undefined)
      break;
    if (start <= offset)
      lo = mid + 1;
    else
      hi = mid - 1;
  }
  return Math.max(
    0,
    hi,
  );
}

/**
 * Removes all syntax highlighting by clearing registered highlight groups.
 *
 * @example
 * ```ts
 * clearHighlights();
 * ```
 */
export function clearHighlights(): void {
  for (const group of HIGHLIGHT_GROUPS)
    CSS.highlights
      .delete(`hl-${group}`,);
}
