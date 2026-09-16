import { createHash, } from 'node:crypto';
import type { NumberedBlock, } from './pair-blocks-wire.ts';
import { PAIRING_CACHE_VERSION, } from './pairing-cache-version.ts';

//region Historical cache encoding remains distinct from complete question identity

/**
 Computes the existing versioned NUL-delimited block cache key without changing its bytes.
 Embedded NUL can alias block boundaries; this key is not complete-question or receipt authority.

 @internal

 @param sourceBlocks - native original block texts in emitted order

 @param targetBlocks - native incumbent block texts in their separate emitted order

 @param pictureContext - transcripts the sheet was shown, folded in after a second
 separator only when non-empty so every key without pictures keeps its historical bytes
 (class thirty-four, 2026-09-16: a pairing bought without the pictures must not answer
 the question asked with them)

 @returns Historical lowercase SHA-256 cache key, not an injective question identity

 @example
 ```ts
 const key = blockPairingQuestionKey({ sourceBlocks, targetBlocks });
 ```
 */
export function blockPairingQuestionKey({
  sourceBlocks,
  targetBlocks,
  pictureContext = '',
}: {
  readonly sourceBlocks: readonly NumberedBlock[];
  readonly targetBlocks: readonly NumberedBlock[];
  readonly pictureContext?: string;
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
      ].join('\u0000',),
      'utf8',
    )
    .digest('hex',);
}

//endregion Historical cache encoding remains distinct from complete question identity
