import { createHash, } from 'node:crypto';
import type { ChunkPair, } from './chunk-document.ts';
import type {
  FreeOrderBlocks,
  NumberedBlock,
} from './pair-blocks-wire.ts';
import { definitionIndexes, } from './pair-definition-order.ts';
import { PAIRING_CACHE_VERSION, } from './pairing-cache-version.ts';

//region Current parent question identity
// Acquisition and provider-free evidence replay must number and identify exactly the same parent blocks.

/**
 * Existing production question, including its historical cache identity.
 * This identity does not claim that cached relations contain current seat evidence.
 *
 * @example
 * ```ts
 * const question = blockPairingQuestion({ pair, });
 * ```
 */
export type BlockPairingQuestion = {
  /**
   * Source indexes local to this complete parent.
   */
  readonly sourceBlocks: readonly NumberedBlock[];
  /**
   * Target indexes under the same local convention.
   */
  readonly targetBlocks: readonly NumberedBlock[];
  /**
   * Definition indexes retaining the existing ordinary-order exemption.
   */
  readonly freeOrder: FreeOrderBlocks;
  /**
   * Unchanged versioned cache key, not a qualification certificate.
   */
  readonly key: string;
};

/**
 * Constructs the question shared by live preparation and retained-outcome replay.
 * It buys no calls and does not alter singleton or empty-side dispatch.
 *
 * @param pair - complete current parent whose parsed nodes define local indexes
 *
 * @returns Numbered text, definition exemptions and existing cache identity
 *
 * @example
 * ```ts
 * const { sourceBlocks, targetBlocks, freeOrder, key, } = blockPairingQuestion({ pair, });
 * ```
 */
export function blockPairingQuestion(
  { pair, }: { readonly pair: ChunkPair; },
): BlockPairingQuestion {
  /**
   * Original blocks under the production question's local numbering.
   */
  const sourceBlocks = pair.source
    .nodes
    .map(function sourceBlock(
      node,
      index,
    ): NumberedBlock {
    return {
      index,
      text: node.text,
    };
  },);
  /**
   * Incumbent blocks under the same numbering rule.
   */
  const targetBlocks = pair.target
    .nodes
    .map(function targetBlock(
      node,
      index,
    ): NumberedBlock {
    return {
      index,
      text: node.text,
    };
  },);
  /**
   * Existing key encoding, including its explicit side separator.
   */
  const key = createHash('sha256',)
    .update(
      [
        String(PAIRING_CACHE_VERSION,),
        ...sourceBlocks.map(function sourceContent(block,): string { return block.text; },),
        '\u0000',
        ...targetBlocks.map(function targetContent(block,): string { return block.text; },),
      ].join('\u0000',),
      'utf8',
    )
    .digest('hex',);
  return {
    sourceBlocks,
    targetBlocks,
    freeOrder: {
      source: definitionIndexes({ nodes: pair.source
        .nodes, },),
      target: definitionIndexes({ nodes: pair.target
        .nodes, },),
    },
    key,
  };
}

//endregion Current parent question identity
