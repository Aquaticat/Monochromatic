/**
 * Client-side entry point for the SSG.
 *
 * Reads pre-computed syntax highlight ranges from `data-hl-<group>` attributes
 * on `<code>` elements and registers them with the CSS Custom Highlight API
 * for styling via `::highlight()` pseudo-elements.
 *
 * Lezer parsing happens at build time via the rehype-highlight plugin.
 * This script only maps pre-computed character offsets to DOM Range objects.
 *
 * Degrades gracefully: if the CSS Custom Highlight API is unavailable
 * or a code block has no pre-computed data, it remains unstyled plain text.
 *
 * @example
 * ```html
 * <script type="module" src="/client/index.js"></script>
 * ```
 */

import { HIGHLIGHT_GROUPS, } from './highlight-groups.ts';
import './search.ts';

export {}; // eslint module boundary marker

//region Offset-to-Range mapping

/** Flattened text node with its character offset within the parent element. */
type TextEntry = {
  readonly node: Text;
  readonly start: number;
};

/**
 * Collects all text nodes and their cumulative offsets within an element.
 *
 * @param element - container element to walk
 *
 * @returns array of text nodes with their start offsets
 */
function collectTextNodes(element: HTMLElement,): TextEntry[] {
  const entries: TextEntry[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );
  let offset = 0;
  let current = walker.nextNode();
  while (current !== null) {
    // oxlint-disable-next-line no-unsafe-type-assertion -- TreeWalker with SHOW_TEXT guarantees Text nodes
    const textNode = current as Text;
    entries.push({
      node: textNode,
      start: offset,
    },);
    offset += textNode.length;
    current = walker.nextNode();
  }
  return entries;
}

/**
 * Creates DOM Range objects from encoded offset pairs, mapping character
 * offsets to the appropriate text nodes within the code element.
 *
 * @param textEntries - pre-collected text nodes with cumulative offsets
 *
 * @param encoded - semicolon-separated `from-to` offset pairs (e.g. `"0-5;15-21"`)
 *
 * @returns array of DOM Range objects spanning the highlighted tokens
 */
function createRangesFromPairs({
  textEntries,
  encoded,
}: {
  readonly textEntries: readonly TextEntry[];
  encoded: string;
},): Range[] {
  const ranges: Range[] = [];

  for (const pair of encoded.split(';',)) {
    const dashIndex = pair.indexOf('-',);
    if (dashIndex === -1)
      continue;

    const fromStr = pair.slice(
      0,
      dashIndex,
    );
    const toStr = pair.slice(dashIndex + 1,);
    const from = Number(fromStr,);
    const to = Number(toStr,);

    for (const entry of textEntries) {
      const nodeEnd = entry.start + entry.node.length;

      if (entry.start >= to || nodeEnd <= from)
        continue;

      const rangeStart = Math.max(
        0,
        from - entry.start,
      );
      const rangeEnd = Math.min(
        entry.node.length,
        to - entry.start,
      );

      const range = new Range();
      range.setStart(
        entry.node,
        rangeStart,
      );
      range.setEnd(
        entry.node,
        rangeEnd,
      );
      ranges.push(range,);
    }
  }

  return ranges;
}

//endregion Offset-to-Range mapping

//region Highlight registration

/**
 * Registers pre-computed syntax highlights for all code blocks on the page.
 *
 * Finds `<pre><code>` elements with `data-hl-*` attributes, maps the encoded
 * offset pairs to DOM Range objects, and registers them with the CSS Custom
 * Highlight API.
 *
 * Ranges from all code blocks are merged into shared per-group highlights
 * so a single `::highlight(hl-keyword)` rule styles all keywords site-wide.
 */
function highlightAllCodeBlocks(): void {
  if (typeof CSS === 'undefined' || !('highlights' in CSS))
    return;

  const codeBlocks = document.querySelectorAll<HTMLElement>('pre > code',);

  /** Accumulated ranges across all code blocks, keyed by highlight group. */
  const allRanges = new Map<string, Range[]>();

  for (const codeElement of codeBlocks) {
    const textEntries = collectTextNodes(codeElement,);

    for (const group of HIGHLIGHT_GROUPS) {
      const encoded = codeElement.getAttribute(`data-hl-${group}`,);
      if (encoded === null || encoded.length === 0)
        continue;

      const ranges = createRangesFromPairs({
        textEntries,
        encoded,
      },);
      if (ranges.length === 0)
        continue;

      let existing = allRanges.get(group,);
      if (existing === undefined) {
        existing = [];
        allRanges.set(
          group,
          existing,
        );
      }
      existing.push(...ranges,);
    }
  }

  for (const group of HIGHLIGHT_GROUPS) {
    const name = `hl-${group}`;
    const ranges = allRanges.get(group,);
    if (ranges !== undefined && ranges.length > 0) {
      CSS.highlights.set(
        name,
        new Highlight(...ranges,),
      );
    }
  }
}

//endregion Highlight registration

highlightAllCodeBlocks();
