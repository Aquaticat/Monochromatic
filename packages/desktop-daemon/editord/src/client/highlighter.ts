// oxlint-disable max-lines -- highlighting is a single cohesive operation: parse text, map token offsets to DOM ranges, register CSS highlights

/**
 * Syntax highlighting engine using Lezer parsing and the CSS Custom Highlight API.
 *
 * Parses text with a Lezer parser, maps token offsets to DOM `Range` objects
 * inside the editor's per-line `<div>` elements, and registers highlights
 * via `CSS.highlights` for styling with `::highlight()` pseudo-elements.
 *
 * Files over 10KB are not highlighted (per PHILOSOPHY.md).
 *
 * @example
 * ```ts
 * applyHighlights({ editor: editorDiv, parser: tsParser });
 * ```
 */

import type { Parser, } from '@lezer/common';
import { highlightTree, } from '@lezer/highlight';

import { l, tagged, } from './log.ts';
import { editorHighlighter, HIGHLIGHT_GROUPS, } from './highlight-tags.ts';

/** Tagged logger for the highlighting subsystem. */
const highlightLog = tagged({ tag: 'highlight', l, },);

/** Bytes in one kilobyte. */
const BYTES_PER_KB = 1_024;

/** Maximum highlight threshold in kilobytes. */
const HIGHLIGHT_LIMIT_KB = 100;

/** Maximum file size in bytes for syntax highlighting (10KB). */
const MAX_HIGHLIGHT_BYTES = HIGHLIGHT_LIMIT_KB * BYTES_PER_KB;

/**
 * Extracts line texts from the editor's child divs.
 * Empty lines (stored as `\n` in the DOM) are returned as empty strings
 * to match the original file content for accurate offset mapping.
 *
 * @param editor - contenteditable container div
 *
 * @returns array of line text strings
 */
function getLineTexts({ editor, }: { editor: HTMLDivElement }): string[] {
  return [...editor.children,].map(function readLine(div,) {
    // oxlint-disable-next-line typescript-eslint/no-unnecessary-condition -- textContent is typed as `string | null` in DOM; null when node has no text
    const text = div.textContent ?? '';
    return text === '\n' ? '' : text;
  },);
}

/**
 * Finds the line index containing a given text offset via reverse linear scan.
 *
 * @param offset - character offset in the full text
 *
 * @param lineStarts - cumulative byte offset at the start of each line
 *
 * @returns zero-based line index
 */
function findLineForOffset({ offset, lineStarts, }: {
  offset: number;
  lineStarts: readonly number[];
}): number {
  for (let i = lineStarts.length - 1; i >= 0; i--) {
    const start = lineStarts[i];
    if (start !== undefined && start <= offset)
      return i;
  }
  return 0;
}

/**
 * Parses text and applies syntax highlighting via CSS Custom Highlight API.
 *
 * Creates `Range` objects pointing to text nodes inside the editor's per-line
 * `<div>` elements, grouped by highlight category. Each group is registered
 * as a named `Highlight` on `CSS.highlights`.
 *
 * @param editor - contenteditable container div whose children are line divs
 *
 * @param parser - Lezer parser configured for the file's language
 */
export function applyHighlights({ editor, parser, }: {
  editor: HTMLDivElement;
  parser: Parser;
}): void {
  const lines = getLineTexts({ editor, },);
  const text = lines.join('\n',);

  if (text.length > MAX_HIGHLIGHT_BYTES) {
    highlightLog.info(`skipping: ${String(text.length,)} bytes exceeds ${String(MAX_HIGHLIGHT_BYTES,)} limit`,);
    clearHighlights();
    return;
  }

  const tree = parser.parse(text,);

  /** Cumulative byte offset at the start of each line. */
  const lineStarts: number[] = [];
  let cumulativeOffset = 0;
  for (const line of lines) {
    lineStarts.push(cumulativeOffset,);
    cumulativeOffset += line.length + 1;
  }

  /** Ranges collected per highlight group name. */
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

  // Register highlights with the CSS Custom Highlight API
  for (const group of HIGHLIGHT_GROUPS) {
    const name = `hl-${group}`;
    const ranges = rangesByGroup.get(group,);
    if (ranges !== undefined && ranges.length > 0) {
      CSS.highlights.set(name, new Highlight(...ranges,),);
    }
    else {
      CSS.highlights.delete(name,);
    }
  }

  highlightLog.info(`applied: ${String(rangesByGroup.size,)} groups`,);
}

/**
 * Removes all syntax highlighting by clearing registered highlight groups.
 */
export function clearHighlights(): void {
  for (const group of HIGHLIGHT_GROUPS) {
    CSS.highlights.delete(`hl-${group}`,);
  }
}
