import { readSliceSkeleton, } from './translate-skeleton.ts';
import {
  describeBlocks,
  sameShape,
} from './translate-validate-blocks.ts';

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
  if (sameShape({
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
