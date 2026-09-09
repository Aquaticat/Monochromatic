import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  askingWindow,
  type FanOutMode,
  rotatedBench,
} from './stage-fanout-window.ts';
import { STAGE_RETRY_ROUNDS, } from './stage-quorum.ts';
import {
  type RoundOutcome,
  runGatherRound,
} from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Stage windowed rounds
// THE WINDOW FOR THE STAGES THAT READ THEIR OWN ROUND. Six stages ask their
// bench through `runGatherRound` directly and read every seat's outcome
// themselves, lost seats included, because what they record is a seat per
// outcome: the lane contest, section pairing, block pairing, the consolidation
// gate, the naturalness review and the polish gate. They never retried a lost
// voice; they asked everyone once, and on the first `noname` pass of
// 2026-09-09 that was 356 seats (lane contest 96, naturalness review 104,
// gate 72, polish 48, pairing 36) for quorums of about half. This is
// `stage-fanout-window.ts` applied to them: quorum plus one seat first, in
// the prompt's rotation, the rest only when a voice is lost, up to
// `STAGE_RETRY_ROUNDS` retry rounds these stages did not have before. A seat
// that answered unreadably is not re-asked, as before.
//
// ONE OUTCOME PER SEAT ASKED, IN ROSTER ORDER. A seat lost in one round and
// heard in the next appears once, heard; a seat the window spared does not
// appear at all, so a caller recording a seat per outcome never counts the
// same seat twice and never records a silence nobody was asked to break.

/**
 * Asks a bench through windowed rounds and returns one outcome per seat
 * asked.
 *
 * @param client - provider client every ask goes through
 *
 * @param modelIds - bench in roster order
 *
 * @param messages - prompt every seat is asked, which also fixes the rotation
 *
 * @param signal - caller cancellation every ask honors
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param maxAnswerChars - answer volume bound, when the stage sets one
 *
 * @param responseFormat - schema every reply must fit
 *
 * @param validate - guard a reply must pass to count as heard
 *
 * @param stage - stage name for log lines
 *
 * @param l - stage logger
 *
 * @param heardNeeded - voices quorum needs, computed over the whole bench
 *
 * @param graceMs - straggler window after quorum, when a test bounds it
 *
 * @param fanOut - window by default; whole bench once for a fixture scripting
 * every seat
 *
 * @returns Outcomes for the seats asked, in roster order, heard where a
 * round heard them and lost otherwise
 *
 * @example
 * ```ts
 * const outcomes = await runWindowedRounds({ client, modelIds, messages, signal, exchangeTimeoutMs, responseFormat, validate, stage: 'gate', l, heardNeeded: 3, },);
 * ```
 */
export async function runWindowedRounds<ValueT,>(
  {
    client,
    modelIds,
    messages,
    signal,
    exchangeTimeoutMs,
    maxAnswerChars,
    responseFormat,
    validate,
    stage,
    l,
    heardNeeded,
    graceMs,
    fanOut = 'window',
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly maxAnswerChars?: number;
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly stage: string;
    readonly l: Logger;
    readonly heardNeeded: number;
    readonly graceMs?: number;
    readonly fanOut?: FanOutMode;
  }>,
): Promise<readonly RoundOutcome<ValueT>[]> {
  /**
   * Everything a round needs except who to ask and how many to wait for.
   */
  const roundRequest = {
    client,
    messages,
    signal,
    exchangeTimeoutMs,
    ...((maxAnswerChars === undefined) ? {} : { maxAnswerChars, }),
    responseFormat,
    validate,
    stage,
    l,
    ...((graceMs === undefined) ? {} : { graceMs, }),
  };
  if (fanOut === 'whole-bench') {
    return await runGatherRound<ValueT>({
      ...roundRequest,
      modelIds,
      heardNeeded,
    },);
  }

  /**
   * Seats still owed an answer: unasked first, in the prompt's rotation,
   * then lost, so a fresh seat is tried before a seat that just failed.
   */
  const pending: RosterModelId[] = [...rotatedBench({
    modelIds,
    messages,
  },),];
  /**
   * Latest outcome per seat asked.
   */
  const latest = new Map<RosterModelId, RoundOutcome<ValueT>>();
  /**
   * Seats heard so far.
   */
  const heardSeats = new Set<RosterModelId>();
  for (let round = 0; round <= STAGE_RETRY_ROUNDS; round += 1) {
    if ((heardSeats.size >= heardNeeded) || (pending.length === 0))
      break;
    /**
     * Seats this round asks: what quorum still needs plus the spare.
     */
    const asking = askingWindow({
      pending,
      needed: heardNeeded - heardSeats.size,
    },);
    if (round > 0) {
      l.warn(
        `${stage}: retry round ${String(round,)} asking ${String(asking.length,)} of ${
          String(pending.length,)
        } pending voices`,
      );
    }
    /* oxlint-disable no-await-in-loop -- rounds are sequential by design: each round asks the seats the previous round left unasked or lost */
    /**
     * This round's outcomes, one per seat asked.
     */
    const outcomes = await runGatherRound<ValueT>({
      ...roundRequest,
      modelIds: asking,
      heardNeeded: heardNeeded - heardSeats.size,
    },);
    /* oxlint-enable no-await-in-loop */
    pending.splice(
      0,
      asking.length,
    );
    for (const outcome of outcomes) {
      /**
       * Seat and voice of this outcome.
       */
      const {
        modelId,
        voice,
      } = outcome;
      latest.set(
        modelId,
        outcome,
      );
      if (voice.heard)
        heardSeats.add(modelId,);
      // A seat that answered unreadably had its chance; only a seat that
      // never delivered an answer is owed another ask.
      else if (!voice.answered)
        pending.push(modelId,);
    }
  }
  return modelIds.flatMap(function inRosterOrder(modelId,): readonly RoundOutcome<ValueT>[] {
    /**
     * What this seat's last ask came to, absent when the window spared it.
     */
    const outcome = latest.get(modelId,);
    return (outcome === undefined) ? [] : [outcome,];
  },);
}

//endregion Stage windowed rounds
