import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  attemptStageCall,
  type StageVoice,
} from './stage-call.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Stage round
// ONE fan-out round, and the rule that a stage never finishes later than its
// slowest voice by more than a bounded grace.
//
// A round used to await every call together, so a model that hung until its
// deadline delayed every stage that seated it by the whole of that deadline,
// 360 seconds on the corpus configuration, however early quorum arrived. The
// user's standing rule of 2026-08-14 is that the failure of any one model for
// the day must not delay the pipeline, and waiting six minutes per gather for a
// voice that never comes is exactly that delay.
//
// Cutting AT quorum was rejected for a measured reason rather than a cautious
// one: quorum on a roster of three is two, so cutting there would discard the
// third voice on nearly every gather, healthy or not, and shrink every ensemble
// to its minimum permanently. The grace window separates the two cases, because
// a working third model answers within seconds of the second and a hung one
// never answers at all.

/**
 * Time a voice still in flight is given once quorum stands.
 *
 * SIXTY SECONDS ORIGINALLY, a user figure of 2026-08-14 chosen between this and
 * cutting at quorum outright, and recorded then as not derived from the latency
 * distribution and due a revisit against one. That revisit happened on
 * 2026-08-17 and the window moved; see
 * `doc/decision/translation-repair-straggler-grace.md`.
 *
 * THE WINDOW WAS BELOW THE TWO SLOWEST MODELS' ORDINARY RANGE, which is why it
 * cut them and nothing else. Whole-call latency over 602 bench exchanges:
 * `hf:openai/gpt-oss-120b` p50 4.4 s, `hf:moonshotai/Kimi-K3` p50 9.5 s,
 * `hf:zai-org/GLM-5.2` p50 24.0 s with p95 74.0 s and max 85.5 s, and
 * `hf:zai-org/GLM-4.7-Flash` p50 30.5 s with p95 72.9 s and max 88.6 s. Sixty
 * seconds sits between the GLM medians and their 95th percentiles, so it cut
 * working voices by construction.
 *
 * IT HAS NEVER CAUGHT WHAT IT EXISTS TO CATCH. Across those 602 exchanges the
 * only non-ok outcomes were 8 straggler cuts, all on the two GLM models, and no
 * timeout of any other kind. Not one hung call was recorded, so every voice the
 * window has taken was a slow-but-working one.
 *
 * THREE MINUTES rather than the observed maximum, deliberately. A maximum over a
 * few hundred samples is not a bound, which `STREAM_IDLE_MS` in
 * `stream-idle-guard.ts` records this codebase learning the hard way, so this
 * sits above the 88.6 s maximum by more than a factor of two. It remains well
 * under `RUN_PER_CALL_TIMEOUT_MS` of 360_000, so the window still cuts a
 * genuinely hung voice long before its own deadline would, which is the whole
 * purpose the user's rule of 2026-08-14 gave it.
 */
export const STRAGGLER_GRACE_MS = 180_000;

/**
 * One model's answer, or its silence, from one round.
 *
 * @example
 * ```ts
 * const outcome: RoundOutcome<Wire> = { modelId, voice: { heard: false, }, };
 * ```
 */
export type RoundOutcome<ValueT,> = {
  /**
   * Model that was asked.
   */
  readonly modelId: SyntheticModelId;

  /**
   * What came back.
   */
  readonly voice: StageVoice<ValueT>;
};

/**
 * Waits until enough voices are heard, or until every ask has settled.
 *
 * Counts HEARD voices rather than settled calls, because a call that came back
 * unusable moves the round no closer to a quorum and waiting on it is the same
 * waiting this module exists to bound.
 *
 * @param asks - in-flight asks, one per model
 *
 * @param heardNeeded - voices this round must hear before the grace starts
 *
 * @example
 * ```ts
 * await awaitHeard({ asks, heardNeeded: 2, },);
 * ```
 */
async function awaitHeard<ValueT,>(
  {
    asks,
    heardNeeded,
  }: {
    readonly asks: readonly Promise<RoundOutcome<ValueT>>[];
    readonly heardNeeded: number;
  },
): Promise<void> {
  /**
   * Asks still to settle, keyed by position so the winner can be removed
   * without identity comparisons on promises.
   */
  const pending = new Map(
    asks.map(function toRace(
      ask,
      index,
    ): readonly [
      number,
      Promise<number>,
    ] {
      return [
        index,
        (async function settleAt(): Promise<number> {
          await ask;
          return index;
        })(),
      ];
    },),
  );

  /**
   * Voices heard so far this round.
   */
  const counters = { heard: 0, };
  while ((counters.heard < heardNeeded) && (pending.size > 0)) {
    /**
     * Position of the ask that settled first among those still pending.
     */
    /* oxlint-disable-next-line no-await-in-loop -- the loop IS the wait: each pass consumes exactly one settled ask and re-races the rest */
    const settled = await Promise.race(pending.values(),);
    pending.delete(settled,);

    /**
     * That ask's outcome, already settled and therefore free to await.
     */
    /* oxlint-disable-next-line no-await-in-loop -- reading an already-settled promise, which suspends for one microtask rather than for a call */
    const outcome = await asks[settled];
    if (outcome?.voice
      .heard
      === true)
      counters.heard += 1;
  }
}

/**
 * Runs one fan-out round and abandons whatever is still in flight once quorum
 * has stood for {@link STRAGGLER_GRACE_MS}.
 *
 * @param client - injected model client
 *
 * @param modelIds - models this round asks
 *
 * @param messages - prompt shared by every voice
 *
 * @param signal - caller abort, which always wins over the straggler cut
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param responseFormat - structured-output constraint
 *
 * @param validate - client-side schema guard
 *
 * @param stage - stage label for logging
 *
 * @param l - logger of the calling stage
 *
 * @param heardNeeded - voices still needed for quorum, which starts the grace
 *
 * @param graceMs - window granted after quorum before stragglers are abandoned;
 * defaults to {@link STRAGGLER_GRACE_MS} and exists so a test can bound its own
 * wall time
 *
 * @returns One outcome per model asked, in roster order
 *
 * @example
 * ```ts
 * const outcomes = await runGatherRound({ ..., heardNeeded: 2, },);
 * ```
 */
export async function runGatherRound<ValueT,>(
  {
    client,
    modelIds,
    messages,
    signal,
    exchangeTimeoutMs,
    responseFormat,
    validate,
    stage,
    l,
    heardNeeded,
    graceMs = STRAGGLER_GRACE_MS,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly SyntheticModelId[];
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly stage: string;
    readonly l: Logger;
    readonly heardNeeded: number;
    readonly graceMs?: number;
  }>,
): Promise<readonly RoundOutcome<ValueT>[]> {
  /**
   * Cut for this round's stragglers, owned here so it can never outlive the
   * round or reach the caller's own abort.
   */
  const abandon = new AbortController();

  /**
   * Signal every call in this round honors: the caller's steering, or this
   * round's cut, whichever comes first.
   */
  const roundSignal = AbortSignal.any([
    signal,
    abandon.signal,
  ],);

  /**
   * Outcomes as they arrive, keyed by roster position.
   *
   * Written from inside each ask so the round can be assembled from whatever
   * HAS answered rather than by awaiting calls it has already abandoned. That
   * matters more than it looks: awaiting an abandoned call would make this
   * round's completion depend on the client honouring an abort, and a client
   * that ignored one would hang the stage forever rather than lose a voice.
   */
  const arrived = new Map<number, RoundOutcome<ValueT>>();

  /**
   * Every ask, in flight together.
   */
  const asks = modelIds.map(async function askOnce(
    modelId,
    index,
  ): Promise<RoundOutcome<ValueT>> {
    try {
      /**
       * This model's answer, or its recorded silence.
       */
      const outcome: RoundOutcome<ValueT> = {
        modelId,
        voice: await attemptStageCall({
          client,
          modelId,
          messages,
          signal: roundSignal,
          exchangeTimeoutMs,
          responseFormat,
          validate,
          stage,
          l,
        },),
      };
      arrived.set(
        index,
        outcome,
      );
      return outcome;
    }
    catch (error) {
      // The CALLER's abort still propagates, so user steering stops a fan-out
      // exactly as it did. Only this round's own cut is turned into a lost
      // voice, because that is what it is: a model that had its chance.
      if (signal.aborted)
        throw error;
      l.warn(
        `${stage} ${modelId}: abandoned ${
          String(graceMs,)
        }ms after quorum (${String(error,)}), voice lost`,
      );

      /**
       * Silence recorded for a model this round stopped waiting on.
       */
      const abandoned: RoundOutcome<ValueT> = {
        modelId,
        voice: { heard: false, },
      };
      arrived.set(
        index,
        abandoned,
      );
      return abandoned;
    }
  },);

  await awaitHeard({
    asks,
    heardNeeded,
  },);

  // Whichever comes first: everyone answers, or the grace expires. A round
  // that never reaches quorum has already waited for every ask above, since
  // `awaitHeard` also stops when nothing is pending, so this resolves at once
  // rather than adding a window to a round that had nothing left to wait for.
  //
  // `allSettled` rather than `all`: the caller's own abort rejects every ask,
  // and a rejected `all` inside a race nobody reads becomes an unhandled
  // rejection on a teardown path.
  await Promise.race([
    Promise.allSettled(asks,),
    wait(graceMs,),
  ],);
  abandon.abort();

  // The caller's abort has to leave this round as a FAILURE, not as a thin
  // roster. `allSettled` above swallows every ask the abort tore down, so a
  // stop that arrives after quorum would otherwise return the voices that beat
  // it and read exactly like an ordinary degraded round: the stage would decide
  // on that, the slice would settle, and the driver would cache a decision the
  // run was told to stop making. Before quorum the rejections already surface
  // through `awaitHeard`; this covers the window after it.
  signal.throwIfAborted();

  return modelIds.map(function toOutcome(
    modelId,
    index,
  ): RoundOutcome<ValueT> {
    return arrived.get(index,) ?? {
      modelId,
      voice: { heard: false, },
    };
  },);
}

//endregion Stage round
