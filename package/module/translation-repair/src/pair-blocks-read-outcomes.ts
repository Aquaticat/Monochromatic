import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { agreePairs, } from './pair-agreement.ts';
import { countPairedBlocks, } from './pair-block-counts.ts';
import type { BlockPairingOutcome, } from './pair-blocks-stage.ts';
import {
  type BlockPair,
  BlockPairingError,
  type BlockPairingWire,
  type FreeOrderBlocks,
  readBlockPairing,
} from './pair-blocks-wire.ts';
import type { RoundOutcome, } from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Pairing outcomes read without transport
// Live stages and frozen preparation recipes share range/order validation and relation agreement.

/**
 * Existing per-relation endorsement threshold, distinct from the stage's roster quorum.
 * Retallying stored outcomes must not introduce another agreement policy.
 */
const AGREEMENT_NEEDED = 2;

/**
 * Reads final asked-seat outcomes through the production pairing reader and agreement rule.
 * A schema-valid heard reply may still be unusable because its indexes or order are invalid.
 * This operation buys no calls and does not turn missing seats into ballots.
 *
 * @param outcomes - final outcomes of exactly the seats the stage asked
 * @param modelIds - configured electorate supplying the reported denominator
 * @param sourceCount - source block bound used by the original question
 * @param targetCount - target block bound used by the original question
 * @param freeOrder - definition indexes exempt from ordinary block ordering
 * @param l - caller logger retaining preparation identity
 * @returns Agreed relations, final seat evidence and unchanged usability findings
 * @throws Error when an unexpected reader failure occurs
 *
 * @example
 * ```ts
 * const retallied = readBlockPairingOutcomes({ outcomes, modelIds, sourceCount: 2, targetCount: 3, l });
 * ```
 */
export function readBlockPairingOutcomes(
  {
    outcomes,
    modelIds,
    sourceCount,
    targetCount,
    freeOrder,
    l,
  }: ForeignBorrowed<{
    readonly outcomes: readonly RoundOutcome<BlockPairingWire>[];
    readonly modelIds: readonly RosterModelId[];
    readonly sourceCount: number;
    readonly targetCount: number;
    readonly freeOrder?: FreeOrderBlocks;
    readonly l: Logger;
  }>,
): BlockPairingOutcome {
  /** Logger distinguishing transport-free interpretation from the purchased stage. */
  const pl = tagged({ tag: readBlockPairingOutcomes.name, l, },);
  /** Replies that arrived and validated in shape. */
  const heardVoices = outcomes.filter(function wasHeard(outcome,): boolean {
    return outcome.voice.heard;
  },);
  /** Findings accumulated while reading replies. */
  const findings: string[] = [];
  /** Pairings that survived the reader, one per usable voice. */
  const pairings: (readonly BlockPair[])[] = [];
  for (const outcome of heardVoices) {
    /** Reply narrowed independently from the filter's array element type. */
    const { voice, } = outcome;
    if (!voice.heard)
      continue;
    try {
      pairings.push(readBlockPairing({
        value: voice.value,
        sourceCount,
        targetCount,
        ...((freeOrder === undefined) ? {} : { freeOrder, }),
      },),);
    }
    catch (error) {
      if (!(error instanceof BlockPairingError))
        throw error;
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
      cacheEligible: false,
      findings,
      outcomes,
    };
  }
  /** Existing many-to-many agreement and monotone-order resolution. */
  const agreement = agreePairs({
    pairings,
    needed: AGREEMENT_NEEDED,
    pairingShape: 'many-to-many',
  },);
  /** Relations the agreement rule withheld. */
  const { findings: dropped, } = agreement;
  findings.push(...dropped.map(function prefix(finding,): string {
    return `block-pairing ${finding}`;
  },),);
  /** Relations preserved by endorsement and ordering. */
  const agreed = agreement.pairs;
  /** Unique block reach beside many-to-many relation count. */
  const counts = countPairedBlocks({ pairs: agreed, },);
  pl.info(
    `paired ${String(counts.source,)} of ${String(sourceCount,)} original and ${
      String(counts.target,)
    } of ${String(targetCount,)} translation blocks across ${String(counts.relations,)} relations, from ${
      String(pairings.length,)
    } usable voices of ${String(heardVoices.length,)} heard`,
  );
  return {
    pairs: agreed,
    heard: heardVoices.length,
    usable: pairings.length,
    cacheEligible: dropped.length === 0,
    findings,
    outcomes,
  };
}

//endregion Pairing outcomes read without transport
