import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { PatchOutcome, } from '../apply-patch.ts';
import type { Candidate, } from '../candidate-select-model.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import { selectChunkPatch, } from '../editor-ensemble.ts';
import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import type { ArmOutcome, } from './editor-width-arm.ts';
import type { WidthProbeInput, } from './editor-width-input.ts';
import {
  type HeadToHeadVerdict,
  readHeadToHead,
  type WidthArm,
} from './editor-width-model.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';

//region Editor width contest
// Two shipped repairs put on one slate, so the panel says which it prefers.
//
// RUN TWICE, once in each seating order. `selectChunkPatch` shows judges the
// candidates in the order it is handed them and does not shuffle, so the seat
// each repair occupies is the probe's to choose and therefore the probe's to
// cancel. A preference that survives the swap is about the text; one that does
// not is about the seat, and reporting the first order alone would launder the
// second into a quality result.

/**
 * What one seating order decided.
 */
type ContestRound = {
  /**
   * Text the panel shipped, which is neither arm when it would not separate
   * them.
   */
  readonly text: string;

  /**
   * Ballots that named a candidate at all.
   */
  readonly usableBallots: number;
};

/**
 * What both seating orders decided together.
 */
export type ContestedPair = {
  /**
   * Reading of the two orders, which agree or the position decided it.
   */
  readonly verdict: HeadToHeadVerdict;

  /**
   * Usable ballots across both orders.
   */
  readonly usableBallots: number;
};

/**
 * Puts two shipped repairs on one slate and asks the panel which it prefers.
 *
 * @param client - injected model client
 *
 * @param input - slice both repairs belong to
 *
 * @param first - repair seated first
 *
 * @param second - repair seated second
 *
 * @param judgeModelIds - panel, the same one both arms faced
 *
 * @param signal - cancellation
 *
 * @param l - logger
 *
 * @returns Text the panel preferred and how many ballots named anything
 *
 * @example
 * ```ts
 * const round = await contest({ client, input, first, second, judgeModelIds, signal, l, },);
 * ```
 */
async function contest(
  {
    client,
    input,
    first,
    second,
    judgeModelIds,
    signal,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly input: WidthProbeInput;
    readonly first: ArmOutcome;
    readonly second: ArmOutcome;
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly l: Logger;
  }>,
): Promise<ContestRound> {
  /**
   * The two repairs as a slate, each still carrying the producers that wrote
   * it so a judge voting for its own work is discounted as in production.
   */
  const candidates: readonly Candidate<PatchOutcome>[] = [
    first,
    second,
  ]
    .map(function toCandidate(arm,): Candidate<PatchOutcome> {
      return {
        producer: {
          kind: 'composite',
          contributors: arm.producers,
        },
        value: arm.patch,
        rendered: arm.patch
          .patchedText,
      };
    },);

  /**
   * Untouched translation, which is what a rejected slate falls back to.
   */
  const unchanged: PatchOutcome = {
    patchedText: input.targetText,
    applied: [],
    rejected: [],
  };

  /**
   * Panel decision over the pair.
   */
  const selection = await selectChunkPatch({
    client,
    candidates,
    judgeModelIds,
    sourceText: input.sourceText,
    // A PAIR THE PANEL WILL NOT SEPARATE FALLS BACK TO NEITHER. Handing the
    // first seat as the fallback would turn every indecision into a win for
    // whichever arm happened to sit there, which is the position bias this
    // whole two-order design exists to cancel.
    indecisionFallback: {
      producer: {
        kind: 'composite',
        contributors: [],
      },
      value: unchanged,
      rendered: unchanged.patchedText,
    },
    rejectionFallback: unchanged,
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    text: selection
      .patch
      .patchedText,
    usableBallots: selection
      .rounds
      .flatMap(function ballotsOf(round,) {
        return round.ballots;
      },)
      .filter(function named(ballot,) {
        return ballot.weight > 0;
      },)
      .length,
  };
}

/**
 * Names which arm a contested text came from.
 *
 * @param text - what the panel shipped
 *
 * @param narrow - narrow arm's repair
 *
 * @param wide - wide arm's repair
 *
 * @returns Arm that wrote it, or none when the panel shipped neither
 *
 * @example
 * ```ts
 * const winner = whoseText({ text, narrow, wide, },);
 * ```
 */
function whoseText(
  {
    text,
    narrow,
    wide,
  }: {
    readonly text: string;
    readonly narrow: ArmOutcome;
    readonly wide: ArmOutcome;
  },
): WidthArm | 'none' {
  /**
   * What each arm actually shipped, read one step at a time.
   */
  const { patchedText: narrowShipped, } = narrow.patch;

  /**
   * {@link narrowShipped} for the wide arm.
   */
  const { patchedText: wideShipped, } = wide.patch;

  if (text === narrowShipped)
    return 'narrow';

  if (text === wideShipped)
    return 'wide';

  return 'none';
}

/**
 * Judges the pair in both seating orders and reads the two together.
 *
 * @param client - injected model client
 *
 * @param input - slice both repairs belong to
 *
 * @param narrow - narrow arm's repair
 *
 * @param wide - wide arm's repair
 *
 * @param judgeModelIds - panel
 *
 * @param signal - cancellation
 *
 * @param l - logger
 *
 * @returns Verdict and how many ballots carried it
 *
 * @example
 * ```ts
 * const contested = await bothOrders({ client, input, narrow, wide, judgeModelIds, signal, l, },);
 * ```
 */
export async function bothOrders(
  {
    client,
    input,
    narrow,
    wide,
    judgeModelIds,
    signal,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly input: WidthProbeInput;
    readonly narrow: ArmOutcome;
    readonly wide: ArmOutcome;
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly signal: AbortSignal;
    readonly l: Logger;
  }>,
): Promise<ContestedPair> {
  /**
   * Narrow seated first.
   */
  const narrowFirst = await contest({
    client,
    input,
    first: narrow,
    second: wide,
    judgeModelIds,
    signal,
    l,
  },);

  /**
   * Wide seated first, which is the same question with the seats swapped.
   */
  const wideFirst = await contest({
    client,
    input,
    first: wide,
    second: narrow,
    judgeModelIds,
    signal,
    l,
  },);

  return {
    verdict: readHeadToHead({
      firstOrderWinner: whoseText({
        text: narrowFirst.text,
        narrow,
        wide,
      },),
      secondOrderWinner: whoseText({
        text: wideFirst.text,
        narrow,
        wide,
      },),
    },),
    usableBallots: narrowFirst.usableBallots + wideFirst.usableBallots,
  };
}

//endregion Editor width contest
