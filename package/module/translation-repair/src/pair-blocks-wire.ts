import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';

import { selectFence, } from './prompt-fence.ts';

//region Block pairing wire
// PAIRING IS THE ONE JOB HERE THAT SCORING CANNOT DO.
//
// The deterministic aligner has three signals and this corpus exhausts all
// three: block kind is constant when every block is a paragraph, Chinese and
// English prose share no Latin tokens, and length is a weak tiebreaker even
// once its expansion is estimated per document rather than assumed. Measured on
// `saurikissa`, that reaches four correct pairings in eight and goes no further
// at any length weight.
//
// The errors that remain are one-to-two correspondences, where a translation
// splits a paragraph the original keeps whole. Reading two languages and saying
// which passage renders which is comprehension, and
// `doc/decision/llm-assisted-block-pairing.md` decides it is done by a model.
//
// A REFUSED PAIRING MUST NOT SILENTLY PROCEED, which `#71` already demanded of
// the section aligner: a wrong pairing manufactures issues rather than skipping
// work, so it is worse than no pairing. Everything this file parses is checked
// against the block counts it was built from, and anything that does not hold
// throws rather than being repaired into something plausible.

/**
 * Signals a pairing a model returned that cannot be used as one.
 *
 * @example
 * ```ts
 * throw new BlockPairingError({ message: 'pair 3 moves backwards on the original side', },);
 * ```
 */
export class BlockPairingError extends Error {
  /**
   * Names the class for callers matching on it.
   */
  public override readonly name = 'BlockPairingError';

  /**
   * @param message - what about the returned pairing cannot be used
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
  }
}

/**
 * One block on one side, as the sheet numbers it.
 *
 * @example
 * ```ts
 * const block: NumberedBlock = { index: 0, text: 'The tabby dozed by the stove.', };
 * ```
 */
export type NumberedBlock = {
  /**
   * Position in document order, zero-based, as the sheet shows it.
   */
  readonly index: number;

  /**
   * The block's own text.
   */
  readonly text: string;
};

/**
 * One committed correspondence between the two sides.
 *
 * @example
 * ```ts
 * const pair: BlockPair = { source: 2, target: 3, };
 * ```
 */
export type BlockPair = {
  /**
   * Original-side block index.
   */
  readonly source: number;

  /**
   * Translation-side block index.
   */
  readonly target: number;
};

/**
 * What a model returns for one document pair.
 *
 * Unpaired blocks are ABSENT rather than listed against a sentinel, because a
 * sentinel invites a model to pair everything and mark the doubtful ones, which
 * is the behaviour this exists to prevent.
 *
 * @example
 * ```ts
 * const wire: BlockPairingWire = { pairs: [{ source: 0, target: 0, },], };
 * ```
 */
export type BlockPairingWire = {
  /**
   * Correspondences the model committed to, in document order.
   */
  readonly pairs: readonly BlockPair[];
};

/**
 * Renders one side's blocks as a numbered, fenced list.
 *
 * @param blocks - blocks in document order
 *
 * @param fence - fence no block text can reproduce
 *
 * @returns Sheet section listing every block against its index
 *
 * @example
 * ```ts
 * const section = renderBlocks({ blocks, fence: '```', },);
 * ```
 */
function renderBlocks(
  {
    blocks,
    fence,
  }: {
    readonly blocks: readonly NumberedBlock[];
    readonly fence: string;
  },
): string {
  return blocks
    .map(function toEntry(block,): string {
      return `[${String(block.index,)}]\n${fence}\n${block.text}\n${fence}`;
    },)
    .join('\n\n',);
}

/**
 * Builds the sheet asking one model to pair two documents' blocks.
 *
 * @param sourceBlocks - original blocks in document order
 *
 * @param targetBlocks - translation blocks in document order
 *
 * @returns Messages for one pairing call
 *
 * @example
 * ```ts
 * const messages = buildBlockPairingMessages({ sourceBlocks, targetBlocks, },);
 * ```
 */
export function buildBlockPairingMessages(
  {
    sourceBlocks,
    targetBlocks,
  }: {
    readonly sourceBlocks: readonly NumberedBlock[];
    readonly targetBlocks: readonly NumberedBlock[];
  },
): readonly ChatMessage[] {
  /**
   * Fence chosen against every block this sheet carries.
   *
   * Both sides are arbitrary prose and either may contain a run of backticks,
   * so a fixed fence would let a block close its own listing and have the rest
   * read as sheet structure.
   */
  const fence = selectFence({
    texts: [
      ...sourceBlocks.map(function toText(block,): string {
        return block.text;
      },),
      ...targetBlocks.map(function toText(block,): string {
        return block.text;
      },),
    ],
  },);

  return [
    {
      role: 'system',
      content: 'You pair the paragraphs of an ORIGINAL document with the paragraphs of a '
        + 'TRANSLATION of it. Return only which original block each translation block '
        + 'renders.\n\n'
        + 'PAIR ONLY WHAT CORRESPONDS. A translation may split one original paragraph '
        + 'into several, merge several into one, add a paragraph the original never had, '
        + 'or omit one entirely. Where a block has no counterpart, LEAVE IT OUT: an '
        + 'omitted block is a correct answer and a wrong pairing is worse than none, '
        + 'because later stages will report differences between two passages that were '
        + 'never about the same thing.\n\n'
        + 'WHERE ONE ORIGINAL BLOCK IS RENDERED BY TWO TRANSLATION BLOCKS, pair the same '
        + 'original index with each of them.\n\n'
        + 'ORDER IS PRESERVED. Both documents say things in the same order, so your '
        + 'pairs must never move backwards on either side.\n\n'
        + 'Return JSON: {"pairs":[{"source":0,"target":0}]} with indices exactly as '
        + 'numbered below.',
    },
    {
      role: 'user',
      content: `ORIGINAL BLOCKS\n\n${
        renderBlocks({
          blocks: sourceBlocks,
          fence,
        },)
      }\n\nTRANSLATION BLOCKS\n\n${
        renderBlocks({
          blocks: targetBlocks,
          fence,
        },)
      }`,
    },
  ];
}

/**
 * Whether a parsed value has the shape of a pairing.
 *
 * SHAPE ONLY. Whether the pairing is usable is
 * {@link readBlockPairing}'s question, because that needs the block counts.
 *
 * @param value - parsed model reply
 *
 * @returns Whether it is a {@link BlockPairingWire}
 *
 * @example
 * ```ts
 * const ok = isBlockPairingWire({ pairs: [], },);
 * ```
 */
export function isBlockPairingWire(value: unknown,): value is BlockPairingWire {
  if ((typeof value) !== 'object')
    return false;
  if (value === null)
    return false;
  if (!('pairs' in value))
    return false;

  /**
   * Candidate pair list, still unknown in shape.
   */
  const { pairs, } = value;
  if (!Array.isArray(pairs,))
    return false;
  return pairs
    .every(function isPair(entry: unknown,): boolean {
      if ((typeof entry) !== 'object')
        return false;
      if (entry === null)
        return false;
      if (!('source' in entry))
        return false;
      if (!('target' in entry))
        return false;

      /**
       * Candidate indices, still unknown in type.
       */
      const {
        source,
        target,
      } = entry;
      return Number.isInteger(source,) && Number.isInteger(target,);
    },);
}

/**
 * Reads a model's pairing, refusing anything that cannot be used as one.
 *
 * REFUSES RATHER THAN REPAIRS. A pairing that runs backwards, names a block
 * that does not exist, or pairs one translation block with two different
 * originals is not a near-miss to be tidied up: it is evidence the model did
 * not do the task, and using part of it would put mismatched passages in front
 * of the critics exactly as before.
 *
 * ONE ORIGINAL MAY APPEAR TWICE, because a translation splitting a paragraph is
 * the correspondence this exists to express. One TRANSLATION block may not,
 * since a single passage renders one place in the original.
 *
 * @param value - parsed model reply
 *
 * @param sourceCount - original blocks the sheet numbered
 *
 * @param targetCount - translation blocks the sheet numbered
 *
 * @returns Pairs in document order
 *
 * @throws BlockPairingError when the reply is not a usable pairing
 *
 * @example
 * ```ts
 * const pairs = readBlockPairing({ value, sourceCount: 4, targetCount: 5, },);
 * ```
 */
export function readBlockPairing(
  {
    value,
    sourceCount,
    targetCount,
  }: {
    readonly value: unknown;
    readonly sourceCount: number;
    readonly targetCount: number;
  },
): readonly BlockPair[] {
  if (!isBlockPairingWire(value,))
    throw new BlockPairingError({ message: 'reply is not a pairing: expected {"pairs":[{"source":n,"target":n}]}', },);

  /**
   * Pairs in the order the model gave them.
   */
  const { pairs, } = value;
  for (const pair of pairs) {
    if ((pair.source < 0) || (pair.source >= sourceCount))
      throw new BlockPairingError({
        message: `pairing names original block ${String(pair.source,)}, and there are ${String(sourceCount,)}`,
      },);
    if ((pair.target < 0) || (pair.target >= targetCount))
      throw new BlockPairingError({
        message: `pairing names translation block ${String(pair.target,)}, and there are ${String(targetCount,)}`,
      },);
  }

  /**
   * Translation blocks already spoken for, since each renders one place.
   */
  const claimedTargets = new Set<number>();
  for (const pair of pairs) {
    if (claimedTargets.has(pair.target,))
      throw new BlockPairingError({
        message: `translation block ${String(pair.target,)} is paired twice, and a passage renders one place`,
      },);
    claimedTargets.add(pair.target,);
  }

  // MONOTONE ON BOTH SIDES. Both documents say things in the same order, so a
  // pairing that moves backwards is describing a document neither side is.
  for (const [at, pair,] of pairs.entries()) {
    /**
     * Pair before this one, absent at the first position.
     */
    const previous = pairs[at - 1];
    if (previous === undefined)
      continue;
    if (pair.source < previous.source)
      throw new BlockPairingError({
        message: `pairing moves backwards on the original side at position ${String(at,)}`,
      },);
    if (pair.target <= previous.target)
      throw new BlockPairingError({
        message: `pairing moves backwards on the translation side at position ${String(at,)}`,
      },);
  }
  return pairs;
}

//endregion Block pairing wire
