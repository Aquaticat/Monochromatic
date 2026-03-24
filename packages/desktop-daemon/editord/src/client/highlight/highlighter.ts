/**
 * Syntax highlighting engine using Lezer parsing and the CSS Custom Highlight API.
 *
 * Parses text with a Lezer parser, maps token offsets to DOM `Range` objects
 * inside the editor's per-line `<div>` elements, and registers highlights
 * via `CSS.highlights` for styling with `::highlight()` pseudo-elements.
 *
 * Files over 100KB are not highlighted (per PHILOSOPHY.md).
 *
 * @example
 * ```ts
 * applyHighlights({ editor: editorDiv, parser: tsParser });
 * ```
 */

import type { Parser, } from '@lezer/common';

import {
  l,
  tagged,
} from '../log.ts';
import { collectHighlightRanges, } from './collect.ts';
import { HIGHLIGHT_GROUPS, } from './tags.ts';
import {
  clearHighlights,
  getLineTexts,
  MAX_HIGHLIGHT_BYTES,
} from './utils.ts';

export { clearHighlights, };

/** Tagged logger for the highlighting subsystem. */
const highlightLog = tagged({ tag: 'highlight', l, },);

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
},): void {
  const lines = getLineTexts({ editor, },);
  const text = lines.join('\n',);

  if (text.length > MAX_HIGHLIGHT_BYTES) {
    highlightLog.info(
      `skipping: ${String(text.length,)} bytes exceeds ${
        String(MAX_HIGHLIGHT_BYTES,)
      } limit`,
    );
    clearHighlights();
    return;
  }

  const tree = parser.parse(text,);
  const rangesByGroup = collectHighlightRanges({ tree, lines, editor, },);

  /** Register highlights with the CSS Custom Highlight API. */
  for (const group of HIGHLIGHT_GROUPS) {
    const name = `hl-${group}`;
    const ranges = rangesByGroup.get(group,);
    if (ranges !== undefined && ranges.length > 0)
      CSS.highlights.set(name, new Highlight(...ranges,),);
    else
      CSS.highlights.delete(name,);
  }

  highlightLog.info(`applied: ${String(rangesByGroup.size,)} groups`,);
}
