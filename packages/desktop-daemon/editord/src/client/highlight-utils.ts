/**
 * Utility functions for the syntax highlighting engine.
 *
 * Extracts line texts from editor DOM, resolves line indices
 * from character offsets, and manages highlight group cleanup.
 */

import { HIGHLIGHT_GROUPS, } from './highlight-tags.ts';

/** Bytes in one kilobyte. */
export const BYTES_PER_KB = 1_024;

/** Maximum highlight threshold in kilobytes. */
export const HIGHLIGHT_LIMIT_KB = 100;

/** Maximum file size in bytes for syntax highlighting. */
export const MAX_HIGHLIGHT_BYTES = HIGHLIGHT_LIMIT_KB * BYTES_PER_KB;

/**
 * Extracts line texts from the editor's child divs.
 * Empty lines (stored as `\n` in the DOM) are returned as empty strings
 * to match the original file content for accurate offset mapping.
 *
 * @param editor - contenteditable container div
 *
 * @returns array of line text strings
 */
export function getLineTexts({ editor, }: { editor: HTMLDivElement }): string[] {
  return [...editor.children,].map(function readLine(div,) {
    // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- textContent is typed as `string | null` in DOM; null when node has no text
    const text = div.textContent ?? '';
    return text === '\n' ? '' : text;
  },);
}

/**
 * Finds the line index containing a given text offset via reverse scan.
 *
 * @param offset - character offset in the full text
 *
 * @param lineStarts - cumulative byte offset at the start of each line
 *
 * @returns zero-based line index
 */
export function findLineForOffset({ offset, lineStarts, }: {
  offset: number;
  lineStarts: readonly number[];
}): number {
  const index = lineStarts.findLastIndex(function startsBeforeOffset(start,) { return start <= offset; },);
  return index === -1 ? 0 : index;
}

/**
 * Removes all syntax highlighting by clearing registered highlight groups.
 */
export function clearHighlights(): void {
  for (const group of HIGHLIGHT_GROUPS) {
    CSS.highlights.delete(`hl-${group}`,);
  }
}
