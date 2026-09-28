import { createHash, } from 'node:crypto';
import type { NumberedBlock, } from './pair-blocks-wire.ts';
import { PAIRING_CACHE_VERSION, } from './pairing-cache-version.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Block-pairing cache key

/**
 Computes the versioned NUL-delimited key a section's pairing is cached under.
 Embedded NUL can alias block boundaries, so the key names a cache slot rather than proving two
 questions identical; its bytes must not change without a pairing cache version bump.

 @internal

 @param sourceBlocks - native original block texts in emitted order

 @param targetBlocks - native incumbent block texts in their separate emitted order

 @param pictureContext - transcripts the sheet was shown, folded in after a second
 separator only when non-empty so every key without pictures keeps its historical bytes
 (class thirty-four, 2026-09-16: a pairing bought without the pictures must not answer
 the question asked with them)

 @param modelIds - roster that answers the question, folded in last, so a pairing one
 bench settled is never resumed for another (ledger X13, 2026-09-28: a section a dry
 reading paired on a subset resumed on the full bench)

 @returns Historical lowercase SHA-256 cache key, not an injective question identity

 @example
 ```ts
 const key = blockPairingQuestionKey({ sourceBlocks, targetBlocks, modelIds, });
 ```
 */
export function blockPairingQuestionKey({
  sourceBlocks,
  targetBlocks,
  pictureContext = '',
  modelIds,
}: {
  readonly sourceBlocks: readonly NumberedBlock[];
  readonly targetBlocks: readonly NumberedBlock[];
  readonly pictureContext?: string;
  readonly modelIds: readonly RosterModelId[];
}): string {
  return createHash('sha256',)
    .update(
      [
        String(PAIRING_CACHE_VERSION,),
        ...sourceBlocks.map(function sourceContent(block,): string { return block.text; },),
        '\u0000',
        ...targetBlocks.map(function targetContent(block,): string { return block.text; },),
        ...((pictureContext === '')
          ? []
          : [
            '\u0000',
            'pictures',
            pictureContext,
          ]),
        '\u0000',
        'roster',
        ...modelIds,
      ].join('\u0000',),
      'utf8',
    )
    .digest('hex',);
}

//endregion Block-pairing cache key
