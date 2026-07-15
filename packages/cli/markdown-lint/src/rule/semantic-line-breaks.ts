import type { ReadonlyDeep, } from 'type-fest';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { Parents, } from 'mdast';

import {
  diagnose,
  offsetsOf,
  positionOf,
  sliceOf,
} from '../node-source.ts';
import { breakOffsets, } from '../semantic-break-points.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'semantic-line-breaks';

/**
 * Characters of source past a text node examined for a break that the parser
 * placed just outside the node. Only inter-node whitespace and one following
 * character are ever needed, so a small bound keeps the per-node lookahead O(1)
 * rather than slicing to the paragraph's end (quadratic on emphasis-dense
 * paragraphs).
 */
const TRAILING_LOOKAHEAD = 256;

/**
 * Ancestor node types whose `text` descendants are not prose to break: headings
 * (single-line), tables, links and images (and their references), reference
 * definitions, raw HTML, and footnotes. A text node under any of these is left
 * alone; MDX nodes are already skipped by the shared walk.
 */
const SKIP_ANCESTORS: ReadonlySet<string> = new Set([
  'heading',
  'table',
  'tableRow',
  'tableCell',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'definition',
  'html',
  'footnoteDefinition',
  'footnoteReference',
],);

/**
 * Parameters for {@link continuationPrefix}.
 */
type ContinuationPrefixParams = {
  /**
   * Paragraph the broken text belongs to.
   */
  readonly paragraph: Parents;
  /**
   * Original source.
   */
  readonly source: string;
};

/**
 * The prefix a continuation line needs to stay inside its block: the paragraph's
 * first-line indentation and markers, with list markers turned into spaces and
 * blockquote markers (`>`) kept. So a list item continues with aligned spaces,
 * a blockquote continues with `>`, and nested cases combine the two.
 *
 * @param paragraph - paragraph the broken text belongs to
 *
 * @param source - original source
 *
 * @returns continuation prefix inserted after each break
 */
function continuationPrefix({
  paragraph,
  source,
}: ReadonlyDeep<ContinuationPrefixParams>,): string {
  /**
   * Paragraph start point.
   */
  const { start, } = positionOf(paragraph,);
  /**
   * Paragraph content start offset.
   */
  const startOffset = nonNullishOrThrow(start.offset,);
  /**
   * Offset of the start of the paragraph's first line.
   */
  const lineStart = startOffset - (start.column - 1);
  /**
   * Source between the line start and the content: indentation plus markers.
   */
  const linePrefix = source.slice(
    lineStart,
    startOffset,
  );
  /**
   * Prefix characters, with list markers blanked and blockquote markers kept.
   */
  const continued: string[] = [];
  for (const ch of linePrefix) {
    /**
     * Whether this character is kept verbatim in the continuation prefix.
     */
    const keep = (ch === '>')
      || (ch === ' ')
      || (ch === '\t');
    continued.push(keep
      ? ch
      : ' ',);
  }
  return continued.join('',);
}

/**
 * Flag prose break-point characters not already followed by a line break, and
 * attach an add-only fix that inserts a newline plus the block's continuation
 * prefix after each. Operates on `text` nodes inside paragraphs (excluding
 * headings, tables, links, definitions, HTML, footnotes, and MDX), with the
 * structural and abbreviation/decimal guards in {@link breakOffsets}. Add-only
 * insertions at distinct points never overlap, so `--fix` converges in one pass.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, for slices, offsets, and the prefix
 *
 * @returns one diagnostic per missing semantic line break
 */
function checkSemanticLineBreaks({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const {
    node,
    ancestors,
  } of walk(tree,)) {
    if (node.type !== 'text') {
      continue;
    }
    if (ancestors.some(function isSkip(ancestor: ReadonlyDeep<Parents>,): boolean {
      return SKIP_ANCESTORS.has(ancestor.type,);
    },)) {
      continue;
    }
    /**
     * Nearest paragraph ancestor, the prose container.
     */
    const paragraph = ancestors.findLast(function isParagraph(ancestor: ReadonlyDeep<Parents>,): boolean {
      return ancestor.type === 'paragraph';
    },);
    if (paragraph === undefined) {
      continue;
    }
    /**
     * Whether this text node is the paragraph's last child.
     */
    const isParagraphTail = paragraph.children
      .at(-1,)
      === node;
    /**
     * Text node's source slice and start offset.
     */
    const slice = sliceOf({
      node,
      source,
    },);
    /**
     * Text node's start and end offsets.
     */
    const {
      start: startOffset,
      end: endOffset,
    } = offsetsOf(node,);
    /**
     * Paragraph's end offset, the far bound of the trailing lookahead.
     */
    const { end: paragraphEnd, } = offsetsOf(paragraph,);
    /**
     * Source between this text node's end and the paragraph's end. A break-point
     * at the node boundary then sees a newline the parser placed just past the
     * node rather than inside it, keeping the rule independent of where a parser
     * ends a text node.
     */
    const trailing = source.slice(
      endOffset,
      Math.min(
        paragraphEnd,
        endOffset + TRAILING_LOOKAHEAD,
      ),
    );
    /**
     * Continuation prefix for this paragraph's block.
     */
    const prefix = continuationPrefix({
      paragraph,
      source,
    },);
    for (const offset of breakOffsets({
      slice,
      trailing,
      isParagraphTail,
    },)) {
      /**
       * Absolute source offset for the insertion.
       */
      const at = startOffset + offset;
      diagnostics.push(diagnose({
        ruleId: ID,
        message: 'Missing line break after a prose break-point character.',
        node,
        fix: {
          start: at,
          end: at,
          insertText: `\n${prefix}`,
        },
      },),);
    }
  }
  return diagnostics;
}

/**
 * semantic-line-breaks: enforce a line break after each prose break-point
 * character. Fixable, add-only: inserts a newline plus the block's continuation
 * prefix, converging in a single pass.
 */
export const semanticLineBreaks: Rule = {
  id: ID,
  fixable: true,
  check: checkSemanticLineBreaks,
};
