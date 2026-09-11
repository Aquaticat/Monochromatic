import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { DocumentNode, } from './document-node.ts';
import { activeFootnoteMarkers, } from './active-footnote-markers.ts';
import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';
import { type FootnoteProtectedRange, overlapsFootnoteProtection, } from './footnote-protected-ranges.ts';
import { FootnoteRewriteError, } from './footnote-rewrite-error.ts';
import { definitionLabelsOf, } from './pair-definition-order.ts';
import { parseDocument, } from './parse-document.ts';

//region Archive footnote definition order
// THE ARCHIVE'S DEFINITIONS STAND IN THE ORIGINAL'S ORDER once their labels
// are the original's, so the block pairing, which never steps backwards, pairs
// each with its counterpart and the slices carry both. A page renders its
// notes by reference order, so moving the definition blocks changes nothing a
// reader sees. Only a contiguous run of definitions is reordered; a page
// whose definitions are interleaved with prose keeps its shape, named.

/**
 * What reordering the definitions did.
 *
 * @example
 * ```ts
 * const reordered: ReorderedDefinitions = reorderFootnoteDefinitions({ text, order: [ '1', '2', ], },);
 * ```
 */
export type ReorderedDefinitions = {
  /**
   * Text with the definitions in the asked order, or as it came.
   */
  readonly text: string;

  /**
   * Whether the text moved.
   */
  readonly changed: boolean;

  /**
   * Why the text stands when it does and the order asked for differs.
   */
  readonly note?: string;

  /** Caller must withhold the entire composed operation, including any preceding rename. */
  readonly blockedByProtection?: true;
};

/**
 * One definition block with its place in the order asked for.
 */
type RankedDefinition = {
  /**
   * The block.
   */
  readonly node: DocumentNode;

  /**
   * Its label's place in the order asked for, or past the end in document
   * order for a label the order does not name.
   */
  readonly rank: number;
};

/**
 * Zone a parsed footnote definition block carries.
 */
const DEFINITION_ZONE = 'footnote-definition';

/**
 * Labels of a text's definitions, in the order the text carries them.
 *
 * @param text - document to read
 *
 * @returns Labels in document order
 *
 * @example
 * ```ts
 * definitionLabelOrder({ text: sourceText, },);
 * // => ['1', '2']
 * ```
 */
export function definitionLabelOrder(
  { text, }: { readonly text: string; },
): readonly string[] {
  return activeFootnoteMarkers({ text, },).filter(function definition(marker,): boolean {
    return marker.kind === 'definition';
  },).map(function label(marker,): string { return marker.rawLabel; },);
}

/**
 * Moves a text's footnote definition blocks into the order of their labels
 * in `order`, labels the order does not name keeping their place after the
 * ones it does.
 *
 * @param text - document whose definitions move
 *
 * @param order - labels in the order wanted
 *
 * @param protectedRanges - original-English intervals in current text coordinates
 *
 * @returns The text, moved or standing, and why it stands
 *
 * @throws FootnoteRewriteError when movement changes parsed definition contents or syntax
 *
 * @example
 * ```ts
 * reorderFootnoteDefinitions({ text: 'A[^1] B[^2].\n\n[^2]: two\n\n[^1]: one\n', order: [ '1', '2', ], },);
 * // => { text: 'A[^1] B[^2].\n\n[^1]: one\n\n[^2]: two\n', changed: true, }
 * ```
 */
export function reorderFootnoteDefinitions(
  {
    text,
    order,
    protectedRanges = [],
  }: {
    readonly text: string;
    readonly order: readonly string[];
    readonly protectedRanges?: readonly FootnoteProtectedRange[];
  },
): ReorderedDefinitions {
  /**
   * Every block of the text.
   */
  const { nodes, containers, } = parseDocument({ text, },);
  /**
   * The definition blocks, in document order.
   */
  const definitions = nodes.filter(function isDefinition(node,): boolean {
    return node.zone === DEFINITION_ZONE;
  },);
  /**
   * The first definition, where the region that moves begins.
   */
  const [first, second,] = definitions;
  /**
   * The last definition, where that region ends.
   */
  const last = definitions.at(-1,);
  if ((first === undefined)
    || (second === undefined)
    || (last === undefined))
    return {
      text,
      changed: false,
    };
  /**
   * Whether a block that is not a definition sits among them.
   */
  const interleaved = nodes.some(function sitsAmong(node,): boolean {
    return (node.zone !== DEFINITION_ZONE)
      && (node.startOffset >= first.startOffset)
      && (node.startOffset < last.endOffset);
  },);
  if (interleaved)
    return {
      text,
      changed: false,
      note: 'the footnote definitions are interleaved with other blocks, so they keep their order',
    };
  /** Containers crossing definition boundaries cannot move as independent block fragments. */
  const splitContainer = containers.some(function crosses(container,): boolean {
    return container.openerStartOffset < last.endOffset && container.closerEndOffset > first.startOffset
      && !definitions.some(function contains(node,): boolean {
        return node.startOffset <= container.openerStartOffset && node.endOffset >= container.closerEndOffset;
      },);
  },);
  if (splitContainer)
    return { text, changed: false, note: 'footnote definitions share container delimiters, so they keep their order', };
  /** Original label ranks use the same normalization as correspondence and rewriting. */
  const normalizedOrder = order.map(function key(label,): string {
    return normalizeFootnoteIdentifier({ identifier: label, },);
  },);
  /**
   * Each definition with its rank.
   */
  const ranked = definitions.map(function toRanked(
    node,
    index,
  ): RankedDefinition {
    /**
     * The block's label, empty when it opens with none.
     */
    const label = definitionLabelsOf({ node, },)[0] ?? '';
    /**
     * Its place in the order asked for, absent as -1.
     */
    const place = normalizedOrder.indexOf(normalizeFootnoteIdentifier({ identifier: label, },),);
    return {
      node,
      rank: (place === (-1)) ? (order.length + index) : place,
    };
  },);
  /**
   * The definitions in the order asked for.
   */
  const sorted = ranked.toSorted(function byRank(
    left,
    right,
  ): number {
    return left.rank - right.rank;
  },);
  if (sorted.every(function stays(
    entry,
    index,
  ): boolean {
    return entry.node === definitions[index];
  },))
    return {
      text,
      changed: false,
    };
  if (overlapsFootnoteProtection({ startOffset: first.startOffset, endOffset: last.endOffset, protectedRanges, },))
    return { text, changed: false, blockedByProtection: true,
      note: 'definition movement would touch protected English-original bytes or their declaration', };
  /** Every original gap is preserved once, in its existing separator position. */
  const gaps = definitions.slice(1,).map(function gap(node, index,): string {
    return text.slice(nonNullishOrThrow(definitions[index],).endOffset, node.startOffset,);
  },);
  if (gaps.some(function containsContent(gap,): boolean {
    for (const character of gap) {
      if (!' \t\r\n'.includes(character,))
        return true;
    }
    return false;
  },))
    return { text, changed: false, note: 'footnote definition gaps contain non-blank content, so they keep their order', };
  /** Changed definitions, with unrelated separator bytes neither dropped nor repeated. */
  const region = sorted.map(function placed(entry, index,): string {
    return `${index === 0 ? '' : nonNullishOrThrow(gaps[index - 1],)}${text.slice(entry.node.startOffset, entry.node.endOffset,)}`;
  },).join('',);
  /** Candidate stays local until syntax and every complete definition block are rechecked. */
  const rewritten = `${text.slice(0, first.startOffset,)}${region}${text.slice(last.endOffset,)}`;
  activeFootnoteMarkers({ text: rewritten, },);
  /** Actual output definition boundaries must still match the complete copied blocks. */
  const reparsed = parseDocument({ text: rewritten, },).nodes.filter(function definition(node,): boolean {
    return node.zone === DEFINITION_ZONE;
  },);
  if (reparsed.length !== sorted.length || reparsed.some(function differs(node, index,): boolean {
    return node.text !== sorted[index]?.node.text;
  },))
    throw new FootnoteRewriteError({ kind: 'graph', },);
  return { text: rewritten, changed: true, };
}

//endregion Archive footnote definition order
