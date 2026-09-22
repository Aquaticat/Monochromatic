import {
  type BlockShape,
  readSliceSkeleton,
} from './translate-skeleton.ts';

//region Archive revision shape
// THE SEVENTY-SEVENTH CLASS (zheermao2, 2026-09-21). The archive block review
// asks reviewers to revise one archive-only block and admits any revision
// that keeps the contributor identities. On the one-line label introducing
// the English rendering of an email exchange ("English translation of the
// preceding email conversation:"), one reviewer answered with a four-block
// letter, its third paragraph cut mid-sentence, and the selection judges
// chose it over the label as "the actual email translation content required
// for the block". The block's own shape is the deterministic bound the lanes
// already hold their candidates to (`translate-validate.ts`): a revision of
// one paragraph is one paragraph, a revised blockquote is a blockquote. A
// removal (an empty revision) is a shape of its own the review allows.

/**
 Finding prefix a revision withheld on shape is recorded under.
 */
export const REVISION_SHAPE_REFUSED = 'archive-revision-refused';

/**
 Renders one block for a finding.

 @param shape - block to describe

 @returns Kind with its distinguishing detail

 @example
 ```ts
 const label = describeBlock({ kind: 'heading', detail: 'level 2', },);
 ```
 */
function describeBlock(shape: BlockShape,): string {
  return (shape.detail === '') ? shape.kind : `${shape.kind} (${shape.detail})`;
}

/**
 Renders a block sequence for a finding.

 @param blocks - blocks in document order

 @returns Comma-separated description, or a word for none

 @example
 ```ts
 const label = describeBlocks({ blocks, },);
 ```
 */
function describeBlocks({ blocks, }: { readonly blocks: readonly BlockShape[]; },): string {
  if (blocks.length === 0)
    return 'nothing';
  return blocks.map(describeBlock,)
    .join(', ',);
}

/**
 Whether two block sequences match block for block by kind and detail.

 @param left - one sequence

 @param right - other sequence

 @returns Whether every block has a counterpart of its kind and detail at its index

 @example
 ```ts
 const same = sameBlocks({ left: block.blocks, right: revision.blocks, },);
 ```
 */
function sameBlocks(
  {
    left,
    right,
  }: {
    readonly left: readonly BlockShape[];
    readonly right: readonly BlockShape[];
  },
): boolean {
  return (left.length === right.length)
    && left.every(function matches(
      block,
      index,
    ): boolean {
      /**
       Counterpart block in the other sequence.
       */
      const other = right[index];
      return (other !== undefined)
        && (other.kind === block.kind)
        && (other.detail === block.detail);
    },);
}

/**
 Why a revision cannot replace the block it revises, when its shape is not
 the block's own.

 A RULE THAT CANNOT READ THE BLOCK SAYS NOTHING: an archive block the slice
 grammar refuses has no shape to hold a revision to, so the revision passes
 to the judges as before. A revision the grammar refuses is withheld, since
 it could not be published either way.

 @param modelId - reviewer who wrote the revision, named in the finding

 @param blockText - archive block under review

 @param replacementText - revision as it would ship

 @returns Findings withholding the revision, empty when it may stand

 @example
 ```ts
 const findings = revisionShapeFindings({ modelId, blockText, replacementText, },);
 ```
 */
export function revisionShapeFindings(
  {
    modelId,
    blockText,
    replacementText,
  }: {
    readonly modelId: string;
    readonly blockText: string;
    readonly replacementText: string;
  },
): readonly string[] {
  // A REMOVAL IS A SHAPE OF ITS OWN the review allows.
  if (replacementText === '')
    return [];
  /**
   Shape of the block under review.
   */
  const block = readSliceSkeleton({ text: blockText, },);
  if (block.kind !== 'read')
    return [];
  /**
   Blocks of the block under review.
   */
  const blockShapes = block.skeleton
    .blocks;
  /**
   Shape of the revision.
   */
  const revision = readSliceSkeleton({ text: replacementText, },);
  if (revision.kind !== 'read')
    return [
      `${REVISION_SHAPE_REFUSED} (${modelId}): the revision does not parse (${revision.detail}); the block is ${
        describeBlocks({ blocks: blockShapes, },)
      }`,
    ];
  /**
   Blocks of the revision.
   */
  const revisionShapes = revision.skeleton
    .blocks;
  if (sameBlocks({
    left: blockShapes,
    right: revisionShapes,
  },))
    return [];
  return [
    `${REVISION_SHAPE_REFUSED} (${modelId}): the block is ${
      describeBlocks({ blocks: blockShapes, },)
    } and the revision is ${
      describeBlocks({ blocks: revisionShapes, },)
    }; a revision keeps the block's own shape`,
  ];
}

//endregion Archive revision shape
