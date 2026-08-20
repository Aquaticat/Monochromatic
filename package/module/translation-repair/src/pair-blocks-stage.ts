import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  type BlockPair,
  BlockPairingError,
  buildBlockPairingMessages,
  isBlockPairingWire,
  type NumberedBlock,
  readBlockPairing,
} from './pair-blocks-wire.ts';
import { runGatherRound, } from './stage-round.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Block pairing stage
// ASKS THE ROSTER WHICH PARAGRAPH RENDERS WHICH, and keeps only what enough of
// them agree on.
//
// NO SINGLE MODEL DECIDES, which is this package's rule everywhere a model is
// asked anything, and it matters more here than usual: a pairing is the input
// every later stage reasons from, so one model's mistake is not one bad claim
// but a document's worth of claims about passages that were never about the
// same thing.
//
// AGREEMENT IS PER PAIR rather than per reply. Two models can agree on nine
// correspondences and differ on the tenth, and discarding both replies over the
// tenth throws away the nine. Each `source,target` pair is counted on its own
// and kept when enough voices named it.

/**
 * Voices that must name a correspondence before it is kept.
 *
 * TWO, not a majority of the roster. A pairing one model invented is the risk
 * here; a correspondence two models reached independently is not plausibly
 * coincidence, since each is choosing from every block on the other side.
 * Requiring more would discard correct pairings whenever the roster is thin,
 * which `#93` and `#112` both recorded as the more common failure.
 */
const AGREEMENT_NEEDED = 2;

/**
 * Voices the round waits for before it starts timing out stragglers.
 */
const HEARD_NEEDED = 2;

/**
 * Schema the reply must satisfy before it reaches the reader.
 */
const PAIRING_RESPONSE_FORMAT: JsonSchemaResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'block_pairing',
    schema: {
      type: 'object',
      properties: {
        pairs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'integer', },
              target: { type: 'integer', },
            },
            required: [
              'source',
              'target',
            ],
          },
        },
      },
      required: [ 'pairs', ],
    },
  },
};

/**
 * What the roster settled on for one document pair.
 *
 * @example
 * ```ts
 * const outcome: BlockPairingOutcome = { pairs: [], heard: 0, usable: 0, findings: [], };
 * ```
 */
export type BlockPairingOutcome = {
  /**
   * Correspondences enough voices named, in document order.
   */
  readonly pairs: readonly BlockPair[];

  /**
   * Voices that answered at all.
   */
  readonly heard: number;

  /**
   * Voices whose answer survived the reader.
   */
  readonly usable: number;

  /**
   * What went wrong, in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Counts how many voices named each correspondence.
 *
 * @param pairings - one usable pairing per voice
 *
 * @returns Voice count per `source,target` key
 *
 * @example
 * ```ts
 * const votes = countPairs({ pairings, },);
 * ```
 */
function countPairs(
  { pairings, }: { readonly pairings: readonly (readonly BlockPair[])[]; },
): ReadonlyMap<string, number> {
  /**
   * Votes so far, keyed by the correspondence itself.
   */
  const votes = new Map<string, number>();
  for (const pairing of pairings)
    for (const pair of pairing) {
      /**
       * This correspondence as one comparable key.
       */
      const key = `${String(pair.source,)},${String(pair.target,)}`;
      votes.set(
        key,
        (votes.get(key,) ?? 0) + 1,
      );
    }
  return votes;
}

/**
 * Asks the roster to pair two block lists and keeps what enough voices agree on.
 *
 * REFUSES RATHER THAN GUESSES. When no voice answers usably the outcome carries
 * no pairs and says why, and the caller falls back to the deterministic aligner
 * rather than proceeding on one model's word. `#71` recorded the rule this
 * follows: a wrong pairing is worse than no pairing, because it manufactures
 * issues rather than skipping work.
 *
 * @param client - injected model client
 *
 * @param modelIds - roster to ask
 *
 * @param sourceBlocks - original blocks in document order
 *
 * @param targetBlocks - translation blocks in document order
 *
 * @param signal - caller's steering
 *
 * @param exchangeTimeoutMs - per-call bound
 *
 * @param l - stage logger
 *
 * @returns What the roster agreed on, with what it lost
 *
 * @example
 * ```ts
 * const outcome = await pairBlocksWithRoster({ client, modelIds, sourceBlocks, targetBlocks, signal, exchangeTimeoutMs, l, },);
 * ```
 */
export async function pairBlocksWithRoster(
  {
    client,
    modelIds,
    sourceBlocks,
    targetBlocks,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly SyntheticModelId[];
    readonly sourceBlocks: readonly NumberedBlock[];
    readonly targetBlocks: readonly NumberedBlock[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<BlockPairingOutcome> {
  /**
   * Logger tagged with this stage.
   */
  const pl = tagged({
    tag: pairBlocksWithRoster.name,
    l,
  },);

  /**
   * Every voice's reply, heard or lost.
   */
  const outcomes = await runGatherRound({
    client,
    modelIds,
    messages: buildBlockPairingMessages({
      sourceBlocks,
      targetBlocks,
    },),
    signal,
    exchangeTimeoutMs,
    responseFormat: PAIRING_RESPONSE_FORMAT,
    validate: isBlockPairingWire,
    stage: 'block-pairing',
    l: pl,
    heardNeeded: HEARD_NEEDED,
  },);

  /**
   * Replies that arrived and validated in shape.
   */
  const heardVoices = outcomes
    .filter(function wasHeard(outcome,) {
      /**
       * This voice's reply, heard or lost.
       */
      const { voice, } = outcome;
      return voice.heard;
    },);

  /**
   * Findings accumulated while reading replies.
   */
  const findings: string[] = [];

  /**
   * Pairings that survived the reader, one per usable voice.
   */
  const pairings: (readonly BlockPair[])[] = [];
  for (const outcome of heardVoices) {
    /**
     * This voice's reply, still either heard or lost to the type system.
     */
    const { voice, } = outcome;
    if (!voice.heard)
      continue;
    try {
      pairings.push(readBlockPairing({
        value: voice.value,
        sourceCount: sourceBlocks.length,
        targetCount: targetBlocks.length,
      },),);
    }
    catch (error) {
      if (!(error instanceof BlockPairingError))
        throw error;
      // A REPLY THAT CANNOT BE USED IS A LOST VOICE, not a stage failure: the
      // rest of the roster may still agree on a pairing, and refusing the whole
      // document because one model answered badly is the failure `#110`
      // recorded.
      findings.push(`block-pairing unusable (${outcome.modelId}: ${error.message})`,);
      pl.warn(`${outcome.modelId} returned an unusable pairing: ${error.message}`,);
    }
  }

  if (pairings.length === 0) {
    findings.push(`block-pairing no-usable-voice (${String(heardVoices.length,)} heard of ${String(modelIds.length,)})`,);
    return {
      pairs: [],
      heard: heardVoices.length,
      usable: 0,
      findings,
    };
  }

  /**
   * Voices per correspondence.
   */
  const votes = countPairs({ pairings, },);

  /**
   * Correspondences enough voices named, in document order.
   *
   * Taken from the FIRST usable pairing's order rather than re-sorted, since
   * each pairing is already monotone and a subset of a monotone sequence stays
   * monotone.
   */
  const agreed = (pairings[0] ?? [])
    .filter(function enoughAgree(pair,): boolean {
      return (votes.get(`${String(pair.source,)},${String(pair.target,)}`,) ?? 0) >= AGREEMENT_NEEDED;
    },);
  pl.info(
    `paired ${String(agreed.length,)} of ${String(sourceBlocks.length,)} original and ${
      String(targetBlocks.length,)
    } translation blocks, from ${String(pairings.length,)} usable voices of ${String(heardVoices.length,)} heard`,
  );
  return {
    pairs: agreed,
    heard: heardVoices.length,
    usable: pairings.length,
    findings,
  };
}

//endregion Block pairing stage
