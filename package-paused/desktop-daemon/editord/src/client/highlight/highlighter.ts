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

/**
 * Tagged logger for the highlighting subsystem.
 */
const highlightLog = tagged({
  tag: 'highlight',
  l,
},);

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
 *
 * @example
 * ```ts
 * applyHighlights({ editor: editor, parser: lezerParser, });
 * ```
 */
export function applyHighlights({
  editor,
  parser,
}: {
  readonly editor: HTMLDivElement;
  readonly parser: Parser;
},): void {
  /**
   * Per-line text content; needed to map Lezer offsets back to per-line DOM nodes.
   */
  const lines = getLineTexts({ editor, },);
  /**
   * Full document text passed to the parser; newline-joined to match Lezer's offset model.
   */
  const text = lines.join('\n',);

  if (text.length
    > MAX_HIGHLIGHT_BYTES) {
    highlightLog.info(
      `skipping: ${String(text.length,)} bytes exceeds ${
        String(MAX_HIGHLIGHT_BYTES,)
      } limit`,
    );
    clearHighlights();
    return;
  }

  /**
   * Lezer syntax tree built from the full text; walked to derive token offsets.
   */
  const tree = parser.parse(text,);
  /**
   * Per-highlight-group DOM ranges; one bucket per token category, suitable for registering as a `Highlight`.
   */
  const rangesByGroup = collectHighlightRanges({
    tree,
    lines,
    editor,
  },);

  /**
   * Register highlights with the CSS Custom Highlight API.
   */
  for (const group of HIGHLIGHT_GROUPS) {
    /**
     * CSS highlight name; matches the `::highlight(hl-<group>)` selector used by stylesheets.
     */
    const name = `hl-${group}`;
    /**
     * Ranges collected for this group, or undefined when no token of this kind appeared.
     */
    const ranges = rangesByGroup.get(group,);
    if ((ranges !== undefined) && (ranges.length
      > 0)) {
      CSS.highlights
        .set(
        name,
        new Highlight(...ranges,),
      );
    }
    else {
      CSS.highlights
        .delete(name,);
    }
  }

  highlightLog.info(`applied: ${String(rangesByGroup.size,)} groups`,);
}
