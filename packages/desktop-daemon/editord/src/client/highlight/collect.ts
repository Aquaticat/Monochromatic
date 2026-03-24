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
function computeLineStarts({ lines, }: { lines: string[]; },): number[] {
  const lineStarts: number[] = [];
  let cumulativeOffset = 0;
  for (const line of lines) {
    lineStarts.push(cumulativeOffset,);
    cumulativeOffset += line.length + 1;
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
 */
export function collectHighlightRanges({ tree, lines, editor, }: {
  tree: Tree;
  lines: string[];
  editor: HTMLDivElement;
},): Map<string, Range[]> {
  const lineStarts = computeLineStarts({ lines, },);
  const rangesByGroup = new Map<string, Range[]>();
  const { children, } = editor;

  highlightTree(tree, editorHighlighter, function collectRange(from, to, group,) {
    const startLine = findLineForOffset({ offset: from, lineStarts, },);
    const endLine = findLineForOffset({ offset: to, lineStarts, },);

    for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
      const div = children[lineIndex];
      if (div === undefined)
        continue;

      const textNode = div.firstChild;
      if (textNode === null)
        continue;

      const lineStart = lineStarts[lineIndex];
      if (lineStart === undefined)
        continue;

      const lineText = lines[lineIndex];

      // Skip empty lines — text node is '\n' placeholder with no visible text
      if (lineText === undefined || lineText === '')
        continue;

      const rangeStart = lineIndex === startLine ? from - lineStart : 0;
      const rangeEnd = lineIndex === endLine ? to - lineStart : lineText.length;

      // Clamp to text node bounds
      const nodeLength = textNode.textContent?.length ?? 0;
      if (rangeStart >= nodeLength)
        continue;

      const range = new Range();
      range.setStart(textNode, Math.min(rangeStart, nodeLength,),);
      range.setEnd(textNode, Math.min(rangeEnd, nodeLength,),);

      let groupRanges = rangesByGroup.get(group,);
      if (groupRanges === undefined) {
        groupRanges = [];
        rangesByGroup.set(group, groupRanges,);
      }
      groupRanges.push(range,);
    }
  },);

  return rangesByGroup;
}
