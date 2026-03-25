/**
 * Read-only query functions for the editor container element.
 *
 * Extracted from `editor-pane.ts` to keep the class under max-lines.
 * These functions provide focused access to editor state without
 * exposing the underlying DOM element.
 */

import type { Range, } from '../../../protocol.ts';

/**
 * Computes a Range covering the entire document inside the editor.
 * Uses the editor's child div count and last line text length
 * to determine the end position.
 *
 * @param editor - the contenteditable container element
 *
 * @returns document range from (0,0) to end-of-file
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
