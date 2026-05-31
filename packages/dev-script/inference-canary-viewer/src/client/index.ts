/**
 * Client-side syntax highlighting via the CSS Custom Highlight API.
 *
 * Finds `<pre><code class="language-ts">` blocks in the page,
 * parses their text with the Lezer JavaScript/TypeScript parser,
 * and registers highlight ranges via `CSS.highlights` for styling
 * with `::highlight(hl-*)` pseudo-elements.
 *
 * Degrades gracefully: if the CSS Custom Highlight API is unavailable,
 * code blocks remain unstyled plain text.
 *
 * @example
 * ```html
 * <script type="module" src="client/index.js"></script>
 * ```
 */

import type {
  Parser,
  Tree,
} from '@lezer/common';
import { highlightTree, } from '@lezer/highlight';

import {
  HIGHLIGHT_GROUPS,
  viewerHighlighter,
} from './tags.ts';

//region Parser loading

/**
 * Lazily loads the Lezer TypeScript parser.
 *
 * @returns configured TypeScript parser instance
 */
async function loadTsParser(): Promise<Parser> {
  /**
   * Destructured Lezer JavaScript parser; configured for TypeScript dialect below.
   */
  const { parser, } = await import('@lezer/javascript');
  return parser.configure({ dialect: 'ts', },);
}

//endregion Parser loading

//region Range collection

/**
 * Language class prefix on `<code>` elements.
 */
const LANGUAGE_PREFIX = 'language-';

/**
 * Checks whether a `<code>` element has a TypeScript language class.
 *
 * @param codeElement - code element to check
 *
 * @returns true when the element has `language-ts` or `language-typescript`
 */
function isTsBlock(codeElement: HTMLElement,): boolean {
  for (const cls of codeElement.classList) {
    if (cls.startsWith(LANGUAGE_PREFIX,)) {
      /**
       * Language identifier extracted from the `language-` class.
       */
      const lang = cls.slice(LANGUAGE_PREFIX.length,);
      if ((lang === 'ts') || (lang === 'typescript'))
        return true;
    }
  }
  return false;
}

/**
 * Collects DOM Range objects from a Lezer parse tree, grouped by highlight category.
 *
 * Walks the code element's text nodes and maps token offsets from
 * `highlightTree` to Range objects inside those nodes.
 *
 * @param tree - Lezer parse tree of the code text
 *
 * @param codeElement - the `<code>` element containing the text
 *
 * @returns map from highlight group name to DOM Range array
 *
 * @example
 * ```ts
 * const tree = parser.parse(codeElement.textContent ?? '',);
 * const rangesByGroup = collectRanges({ tree, codeElement, });
 * // Map(2) { 'keyword' => [Range, Range], 'string' => [Range] }
 * ```
 */
function collectRanges({
  tree,
  codeElement,
}: {
  readonly tree: Tree;
  readonly codeElement: HTMLElement;
},): Map<string, Range[]> {
  /**
   * Flattened text nodes with their start offsets within the full text.
   */
  const textNodes: {
    node: Text;
    start: number;
  }[] = [];
  /**
   * TreeWalker over text nodes; iterated below to flatten them into `textNodes`.
   */
  const walker = document.createTreeWalker(
    codeElement,
    NodeFilter.SHOW_TEXT,
  );
  /**
   * Running text offset across the walked nodes, used to compute Range positions.
   */
  let offset = 0;
  /**
   * Current node being visited by the TreeWalker; advances each loop iteration.
   */
  let current = walker.nextNode();
  while (current !== null) {
    if (current instanceof Text) {
      textNodes.push({
        node: current,
        start: offset,
      },);
      offset += current.length;
    }
    current = walker.nextNode();
  }

  /**
   * Accumulator that maps each highlight group to the DOM Ranges contributing to it.
   */
  const rangesByGroup = new Map<string, Range[]>();

  highlightTree(
    tree,
    viewerHighlighter,
    function collectRange(
      from,
      to,
      group,
    ) {
      for (const entry of textNodes) {
        /**
         * End offset of the current text node within the full code text.
         */
        const nodeEnd = entry.start
          + entry
          .node
          .length;

        if ((entry.start
          >= to) || (nodeEnd <= from))
          continue;

        /**
         * Range start offset within the current text node, clamped to its bounds.
         */
        const rangeStart = Math.max(
          0,
          from - entry
            .start,
        );
        /**
         * Range end offset within the current text node, clamped to its bounds.
         */
        const rangeEnd = Math.min(
          entry.node
            .length,
          to - entry
            .start,
        );

        /**
         * DOM Range covering the overlap between the highlight span and this text node.
         */
        const range = new Range();
        range.setStart(
          entry.node,
          rangeStart,
        );
        range.setEnd(
          entry.node,
          rangeEnd,
        );

        /**
         * Existing range array for the group; created lazily on first insert.
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

//endregion Range collection

//region Highlight application

/**
 * Highlights all TypeScript code blocks on the page.
 *
 * Finds `<pre><code class="language-ts">` elements, parses their content,
 * and registers highlight ranges via the CSS Custom Highlight API.
 *
 * Ranges from all code blocks are merged into shared per-group highlights
 * so a single `::highlight(hl-keyword)` rule styles all keywords page-wide.
 */
async function highlightAllCodeBlocks(): Promise<void> {
  if (((typeof CSS) === 'undefined') || (!('highlights' in CSS)))
    return;

  /**
   * All language-tagged code blocks on the page; filtered to TypeScript below.
   */
  const codeBlocks = document.querySelectorAll<HTMLElement>(
    'pre > code[class*="language-"]',
  );
  /**
   * Subset of `codeBlocks` whose language class is `ts` or `typescript`.
   */
  const tsBlocks = [...codeBlocks,].filter(function filterTs(el,) {
    return isTsBlock(el,);
  },);

  if (tsBlocks.length
    === 0)
    return;

  /**
   * Configured TypeScript parser; loaded only when at least one TS block exists.
   */
  const parser = await loadTsParser();

  /**
   * Accumulated ranges across all code blocks, keyed by highlight group.
   */
  const allRanges = new Map<string, Range[]>();

  for (const codeElement of tsBlocks) {
    /**
     * Raw text content of the code block; fed to the Lezer parser.
     */
    const text = codeElement.textContent;
    if (text.length
      === 0)
      continue;

    /**
     * Lezer parse tree produced from the block's text.
     */
    const tree = parser.parse(text,);
    /**
     * Ranges produced from this block alone, grouped by highlight category.
     */
    const blockRanges = collectRanges({
      tree,
      codeElement,
    },);

    for (const [group, ranges,] of blockRanges) {
      /**
       * Accumulator slot for this group; created on first encounter.
       */
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
    /**
     * Highlight name used as the key for `CSS.highlights`; matches the `::highlight(...)` pseudo.
     */
    const name = `hl-${group}`;
    /**
     * Ranges accumulated for this group across all blocks.
     */
    const ranges = allRanges.get(group,);
    if ((ranges !== undefined) && (ranges.length
      > 0)) {
      CSS.highlights
        .set(
        name,
        new Highlight(...ranges,),
      );
    }
  }
}

//endregion Highlight application

await highlightAllCodeBlocks();
