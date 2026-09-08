import {
  chunkByHeadings,
  type SectionAlignment,
} from './chunk-document.ts';
import type { RepairDocument, } from './parse-document.ts';
import type { UnclaimedTargetBlock, } from './prepared-document-pair.ts';

//region Target blocks outside alignment
// The archive blocks no aligned section owns, which no slice can review and
// which the block correction round is handed instead, split out of
// `document-preparation.ts` at its line budget.

/**
 * Target blocks outside every aligned section, less the ones a seal covers.
 *
 * A SEALED BLOCK IS NOT UNCLAIMED: it is out of review by rule, and the block
 * correction round must not be handed it either.
 *
 * @param alignment - aligned section pairs over both documents
 *
 * @param targetDocument - parsed archive
 *
 * @param sealedTargetIds - ids of every translation block a seal covers
 *
 * @returns Unclaimed blocks in document order, located by their section
 *
 * @example
 * ```ts
 * const unclaimed = unclaimedOutsideAlignment({ alignment, targetDocument, sealedTargetIds, },);
 * ```
 */
export function unclaimedOutsideAlignment(
  {
    alignment,
    targetDocument,
    sealedTargetIds,
  }: {
    readonly alignment: SectionAlignment;
    readonly targetDocument: RepairDocument;
    readonly sealedTargetIds: ReadonlySet<string>;
  },
): readonly UnclaimedTargetBlock[] {
  /**
   * Target node ids belonging to some aligned section.
   */
  const alignedTargetIds = new Set(
    alignment.pairs
      .flatMap(function toTargetIds(pair,): readonly string[] {
        return pair.target
          .nodes
          .map(function toId(node,): string {
            return node.id;
          },);
      },),
  );
  return chunkByHeadings({ document: targetDocument, },)
    .flatMap(function outsideAlignment(
      chunk,
      sectionIndex,
    ): readonly UnclaimedTargetBlock[] {
      return chunk.nodes
        .filter(function isOutside(node,): boolean {
          return (!alignedTargetIds.has(node.id,)) && (!sealedTargetIds.has(node.id,));
        },)
        .map(function toUnclaimed(node,): UnclaimedTargetBlock {
          return {
            location: {
              kind: 'target-section',
              sectionIndex,
            },
            blockId: node.id,
            startOffset: node.startOffset,
            endOffset: node.endOffset,
          };
        },);
    },);
}

//endregion Target blocks outside alignment
