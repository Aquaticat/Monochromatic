import type { ReadonlyDeep, } from 'type-fest';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type {
  Nodes,
  Parents,
} from 'mdast';

import {
  diagnose,
  offsetsOf,
  positionOf,
  sliceOf,
} from '../node-source.ts';
import { breakOffsets, } from '../semantic-break-points.ts';
import {
  lineStartOffsets,
  pointAt,
} from '../source-position.ts';
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
 * Inline node types whose closing delimiter follows their last child's text, so
 * a break after that text's final break-point character would land between the
 * text and the delimiter. CommonMark then reads the delimiter as preceded by a
 * line ending and followed by a space, which is neither left- nor right-flanking,
 * so it stops closing the span and renders as literal asterisks.
 * `package/cli/markdown-lint/doc/semantic-line-breaks-breaks-bold.md` records the
 * measurement.
 */
const DELIMITED_INLINE: ReadonlySet<string> = new Set([
  'strong',
  'emphasis',
  'delete',
],);

/**
 * Parameters for {@link tailThroughDelimiters}.
 */
type TailThroughDelimitersParams = {
  /**
   * Text node whose tail position is being resolved.
   */
  readonly node: ReadonlyDeep<Nodes>;
  /**
   * Ancestors from root to the text node's parent.
   */
  readonly ancestors: readonly ReadonlyDeep<Parents>[];
};

/**
 * The outermost node ending where this text ends, seen through closing inline
 * delimiters, and that node's end offset.
 *
 * A text node that is the last child of `**...**` ends where its own text ends,
 * but the span it belongs to ends two characters later. Every question about
 * what follows the text (is there already a break, is this the paragraph's final
 * punctuation, where would a break go) is a question about the span rather than
 * the text, so both the lookahead and the insertion point come from here.
 * Nesting is walked outward, so `**_word._**` resolves to the strong span.
 *
 * @param node - text node whose tail position is being resolved
 *
 * @param ancestors - ancestors from root to the text node's parent
 *
 * @returns outermost co-terminating node and its end offset
 */
function tailThroughDelimiters({
  node,
  ancestors,
}: TailThroughDelimitersParams,): {
  readonly tailNode: ReadonlyDeep<Nodes>;
  readonly tailEnd: number;
} {
  /**
   * How many wrappers out from the text node still end where it ends.
   *
   * A count rather than the node itself, because holding a node from `ancestors`
   * in a mutable local and then writing another property of that local reads as a
   * write to caller-owned state: the local has taken the parameter's provenance,
   * and the rule cannot tell which of its properties the write lands on. Counting
   * keeps every mutable value a number.
   */
  const climbed = { count: 0, };
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    /**
     * Candidate wrapper immediately outside the current tail node.
     */
    const ancestor = ancestors[index];
    if ((ancestor === undefined) || (!DELIMITED_INLINE.has(ancestor.type,))) {
      break;
    }
    /**
     * Node the candidate wrapper must end on to keep the chain going.
     */
    const inner = climbed.count === 0
      ? node
      : ancestors[index + 1];
    /**
     * Children of the candidate wrapper.
     */
    const { children, } = ancestor;
    /* oxlint-disable-next-line unicorn/prefer-at -- measured, not assumed: `at` on an
     * array whose elements are objects reports the receiver as reaching unresolved
     * code, while an index read of the same element does not, and the same `at` on an
     * array of primitives is silent. `receiverClaimAnswerable` discharges a
     * verified-narrow member only when its result carries no caller-owned state or
     * provably does not escape, and the index path is not held to that. Suppressing the
     * stylistic rule keeps the correctness rule satisfied, which is the way round that
     * ordering goes. */
    if (children[children.length - 1] !== inner) {
      break;
    }
    climbed.count += 1;
  }
  /**
   * Outermost node the chain reached, the text node itself when it climbed nothing.
   */
  const tailNode = ancestors[ancestors.length - climbed.count] ?? node;
  return {
    tailNode,
    tailEnd: offsetsOf(tailNode,)
      .end,
  };
}

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
  /**
   * Line ending this document is written with, so an inserted break matches the
   * ones already there rather than mixing conventions inside one file.
   */
  const lineEnding = source.includes('\r\n',)
    ? '\r\n'
    : '\n';
  /**
   * Line starts for this document, built once so anchoring every break at its
   * own offset costs one scan rather than one per diagnostic.
   */
  const lineStarts = lineStartOffsets(source,);
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
     * Outermost node ending where this text ends, and that node's end offset.
     *
     * For text directly in a paragraph this is the text node itself. For the last
     * child of a bold or italic span it is the span, whose end sits just past the
     * closing delimiter, which is what every question below is really about.
     */
    const {
      tailNode,
      tailEnd,
    } = tailThroughDelimiters({
      node,
      ancestors,
    },);
    /**
     * Whether this text ends the paragraph, seen through any closing delimiters.
     *
     * A bold span at a paragraph's end makes the paragraph's last child the span
     * rather than the text inside it, so comparing the text node alone would call
     * the paragraph's final punctuation mid-prose and break after it.
     */
    const isParagraphTail = paragraph.children
      .at(-1,)
      === tailNode;
    /**
     * Text node's source slice and start offset.
     */
    const slice = sliceOf({
      node,
      source,
    },);
    /**
     * Text node's start offset.
     */
    const { start: startOffset, } = offsetsOf(node,);
    /**
     * Paragraph's end offset, the far bound of the trailing lookahead.
     */
    const { end: paragraphEnd, } = offsetsOf(paragraph,);
    /**
     * Where to read the source between the tail node's end and the paragraph's
     * end. A break-point at the node boundary then sees a newline the parser
     * placed just past the node rather than inside it, keeping the rule
     * independent of where a parser ends a text node. Measured from the tail
     * node rather than the text node, so a document already broken after a bold
     * span reads as broken rather than as missing a break before the closing
     * delimiter.
     */
    const trailing = {
      source,
      tailEnd,
      paragraphEnd,
    };
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
       *
       * A break at the very end of the text goes after the closing delimiters
       * rather than between the text and them, which is where it belongs anyway
       * and is what keeps the span closing. The condition is the slice's own
       * end, not its last non-whitespace character: a closing emphasis
       * delimiter can never have whitespace in front of it, since that stops it
       * closing its span at all, so nothing is lost by the stricter test. What
       * is gained is that a break never steps over a space the author wrote and
       * leaves it at the line's end, where a second one would be a hard break
       * and where one alone reads as trailing rubbish.
       */
      const at = offset === slice.length
        ? tailEnd
        : startOffset + offset;
      diagnostics.push(diagnose({
        ruleId: ID,
        message: 'A line break belongs here, after a prose break-point character.',
        point: pointAt({
          source,
          lineStarts,
          offset: at,
        },),
        fix: {
          start: at,
          end: at,
          insertText: `${lineEnding}${prefix}`,
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
