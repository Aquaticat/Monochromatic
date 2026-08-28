import type { UnclaimedTargetBlock, } from '../document-preparation.ts';

//region Unreviewed archive refusal
// Archive wording no source passage claims cannot bypass every quality stage and
// then become publication fallback. Preparation already records those blocks;
// this boundary turns that evidence into fail-closed corpus behaviour.

/**
 * Names unreviewed blocks by pair and parser id.
 *
 * @param blocks - archive blocks outside source claims
 *
 * @returns Names containing no corpus text
 *
 * @example
 * ```ts
 * const locations = unreviewedLocations({ blocks, });
 * ```
 */
function unreviewedLocations(
  { blocks, }: { readonly blocks: readonly UnclaimedTargetBlock[]; },
): string {
  return blocks.map(function toLocation(block,): string {
    /**
     * Structured alignment location.
     */
    const { location: blockLocation, } = block;
    /**
     * Alignment location rendered without corpus wording.
     */
    const location = (blockLocation.kind === 'aligned-pair')
      ? `pair/${String(blockLocation.pairIndex,)}`
      : `target-section/${String(blockLocation.sectionIndex,)}`;
    return `${location}/${block.blockId}`;
  },)
    .join(', ',);
}

/**
 * Failure raised when archive blocks would bypass source-aligned quality stages.
 *
 * @example
 * ```ts
 * throw new UnreviewedArchiveError({ entryId: 'Cat', blocks, });
 * ```
 */
export class UnreviewedArchiveError extends Error {
  /**
   * Declares message safe to forward because it names only entry, counts and parser ids.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Entry refused.
   */
  readonly entryId: string;

  /**
   * Blocks that would bypass review.
   */
  readonly blocks: readonly UnclaimedTargetBlock[];

  /**
   * @param entryId - entry refused
   *
   * @param blocks - archive blocks outside source claims
   */
  public constructor(
    {
      entryId,
      blocks,
    }: {
      readonly entryId: string;
      readonly blocks: readonly UnclaimedTargetBlock[];
    },
  ) {
    super(`entry ${entryId} has ${String(blocks.length,)} unreviewed archive block(s) at ${
      unreviewedLocations({ blocks, },)
    }`,);
    this.name = 'UnreviewedArchiveError';
    this.entryId = entryId;
    this.blocks = blocks;
  }
}

/**
 * Refuses publication work when preparation left archive blocks outside source claims.
 *
 * @param entryId - corpus entry being prepared
 *
 * @param blocks - structured unclaimed target blocks from preparation
 *
 * @throws {@link UnreviewedArchiveError} when any block would bypass quality stages
 *
 * @example
 * ```ts
 * assertArchiveReviewed({ entryId: 'Cat', blocks: prepared.unclaimedTargetBlocks, });
 * ```
 */
export function assertArchiveReviewed(
  {
    entryId,
    blocks,
  }: {
    readonly entryId: string;
    readonly blocks: readonly UnclaimedTargetBlock[];
  },
): void {
  if (blocks.length === 0)
    return;
  throw new UnreviewedArchiveError({
    entryId,
    blocks,
  },);
}

//endregion Unreviewed archive refusal
