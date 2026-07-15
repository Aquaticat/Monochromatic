/**
 * Highlight range collection for the syntax highlighting engine.
 *
 * Walks the Lezer parse tree via `highlightTree` and maps token offsets
 * to DOM `Range` objects inside the editor's per-line `<div>` elements.
 */

import type { Tree, } from '@lezer/common';
import { highlightTree, } from '@lezer/highlight';

import { editorHighlighter, } from './tags.ts';
import { findLineForOffset, } from './utils.ts';

/**
 * Computes cumulative byte offsets at the start of each line.
 *
 * @param lines - array of line text strings
 *
 * @returns array of cumulative offsets
 */
function computeLineStarts({ lines, }: { readonly lines: readonly string[]; },): number[] {
  /**
   * Accumulator: byte offset of each line's first character, indexed by line number.
   */
  const lineStarts: number[] = [];
  /**
   * Running byte total walked through `lines`, including the `\n` terminator after each line.
   */
  let cumulativeOffset = 0;
  for (const line of lines) {
    lineStarts.push(cumulativeOffset,);
    cumulativeOffset += line.length
      + 1;
  }
  return lineStarts;
}

/**
 * Collects highlight ranges from a parse tree, mapping token offsets
 * to DOM Range objects inside editor line divs.
 *
 * @param tree - Lezer parse tree
 *
 * @param lines - line text strings extracted from the editor
 *
 * @param editor - contenteditable container div
 *
 * @returns map from highlight group name to DOM Range array
 *
 * @example
 * ```ts
 * const result = collectHighlightRanges({ tree: syntaxTree, lines: editorLines, editor: editor, });
 * ```
 */
export function collectHighlightRanges({
  tree,
  lines,
  editor,
}: {
  readonly tree: Tree;
  readonly lines: readonly string[];
  readonly editor: HTMLDivElement;
},): Map<string, Range[]> {
  /**
   * Byte offsets of each line, used to translate parse-tree offsets into per-line positions.
   */
  const lineStarts = computeLineStarts({ lines, },);
  /**
   * Output accumulator: highlight ranges grouped by highlight tag name.
   */
  const rangesByGroup = new Map<string, Range[]>();
  /**
   * Per-line `<div>` elements of the editor; indexed by line number to locate text nodes.
   */
  const { children, } = editor;

  highlightTree(
    tree,
    editorHighlighter,
    function collectRange(
      from,
      to,
      group,
    ) {
      /**
       * Line index containing the highlight start offset.
       */
      const startLine = findLineForOffset({
        offset: from,
        lineStarts,
      },);
      /**
       * Line index containing the highlight end offset; may equal `startLine` for single-line tokens.
       */
      const endLine = findLineForOffset({
        offset: to,
        lineStarts,
      },);

      for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
        /**
         * Editor line `<div>` for this line index; undefined if the editor has been mutated mid-walk.
         */
        const div = children[lineIndex];
        if (div === undefined)
          continue;

        /**
         * First child of the line div, expected to be the text node holding the line's characters.
         */
        const textNode = div.firstChild;
        if (textNode === null)
          continue;

        /**
         * Byte offset where this line begins in the document; undefined for indices beyond `lineStarts`.
         */
        const lineStart = lineStarts[lineIndex];
        if (lineStart === undefined)
          continue;

        /**
         * Raw text of this line; undefined for out-of-range indices, empty string for blank lines.
         */
        const lineText = lines[lineIndex];

        // Skip empty lines: text node is '\n' placeholder with no visible text
        if ((lineText === undefined) || (lineText === ''))
          continue;

        /**
         * Highlight start column within this line: clipped to 0 unless this is the first line of the token.
         */
        const rangeStart = lineIndex === startLine ? from - lineStart : 0;
        /**
         * Highlight end column within this line: clipped to line end unless this is the last line of the token.
         */
        const rangeEnd = lineIndex === endLine ? to - lineStart : lineText.length;

        /**
         * Visible character count in the text node; used to clamp range bounds against the actual DOM content.
         */
        const nodeLength = textNode.textContent
          ?.length
          ?? 0;
        if (rangeStart >= nodeLength)
          continue;

        /**
         * DOM Range covering the highlight on this line; clamped to the text node so setEnd never throws.
         */
        const range = new Range();
        range.setStart(
          textNode,
          Math.min(
            rangeStart,
            nodeLength,
          ),
        );
        range.setEnd(
          textNode,
          Math.min(
            rangeEnd,
            nodeLength,
          ),
        );

        /**
         * Existing range array for this highlight group, or undefined when this is the first range.
         */
        let groupRanges = rangesByGroup.get(group,);
        if (groupRanges === undefined) {
          groupRanges = [];
          rangesByGroup.set(
            group,
            groupRanges,
          );
        }
        groupRanges.push(range,);
      }
    },
  );

  return rangesByGroup;
}
