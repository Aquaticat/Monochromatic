import type { DocumentNode, } from './document-node.ts';
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
 * Separator written between definitions when the text carries none to copy.
 */
const DEFAULT_GAP = '\n\n';

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
  return parseDocument({ text, },)
    .nodes
    .flatMap(function toLabels(node,): readonly string[] {
      return definitionLabelsOf({ node, },);
    },);
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
 * @returns The text, moved or standing, and why it stands
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
  }: {
    readonly text: string;
    readonly order: readonly string[];
  },
): ReorderedDefinitions {
  /**
   * Every block of the text.
   */
  const { nodes, } = parseDocument({ text, },);
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
    const place = order.indexOf(label,);
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
  /**
   * What the text writes between its first two definitions, copied between
   * every pair after the move.
   */
  const gap = text.slice(
    first.endOffset,
    second.startOffset,
  ) || DEFAULT_GAP;
  /**
   * The moved region.
   */
  const region = sorted
    .map(function toText(entry,): string {
      return text.slice(
        entry.node
          .startOffset,
        entry.node
          .endOffset,
      );
    },)
    .join(gap,);
  return {
    text: [
      text.slice(
        0,
        first.startOffset,
      ),
      region,
      text.slice(last.endOffset,),
    ]
      .join('',),
    changed: true,
  };
}

//endregion Archive footnote definition order
