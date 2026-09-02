import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import { rosterQuorumSize, } from './roster-quorum-size.ts';
import { runGatherRound, } from './stage-round.ts';
import { stageQuorumUnmetFinding, } from './stage-silence.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Stage quorum
// A stage that loses voices retries exactly the lost ones on fresh
// deadlines (user directive: quota regenerates faster than runs spend, so
// forfeiting voices cheaply leaves capacity unused). Retries stop at
// QUORUM, at least half the roster rounded up, for every stage. A roster
// still short after every round proceeds with what it has and records the
// degradation as findings.
//
// WAITING FOR THE WHOLE ROSTER IS NOT AN OPTION HERE, and used to be. The
// editor and refiner stages passed `retryTarget: 'full-roster'` from
// 2026-08-12 until the user removed the option outright on 2026-08-14:
// waiting on every voice makes one provider-side model degrading for a day
// block every stage that seats it, spending four deadlines per gather on a
// voice that will not come. The property full-roster was chosen to protect,
// no stage decided by a single model, is already held by the quorum
// arithmetic on the rosters that exist: editors, refiners and checkers all
// sit at three with a quorum of two.
//
// Critics never used it either, by a separate user decision on 2026-07-23,
// for the same reason stated locally: waiting on a complete roster stalls a
// run when a voice wedges.

/**
 * Retry rounds after the initial fan-out;
 * the milestone-one benchmark showed one fresh attempt recovers most
 * forfeits, and three rounds bound the worst stage wall time at four
 * deadlines.
 */
export const STAGE_RETRY_ROUNDS = 3;

/**
 * What the recovery round adds to the prompt of a model whose answer nothing
 * could read.
 *
 * THE COMPLAINT IS THE ROUND'S WHOLE VALUE. `promptUniqueClient` answers a
 * second call for the same model and prompt from its cache, schema mismatch
 * included, so a recovery round that re-sent the same bytes was answered with
 * the same unreadable bytes in 0 to 1 ms on every one of the five occasions
 * measured across two passes on 2026-09-02 (`#473`). The guard here is a type
 * predicate and carries no message of its own, so the complaint names the
 * failure in general terms: the answer arrived and its shape was not the one
 * asked for. That is enough to make the digest new and to tell the model what
 * to do differently.
 */
export const RECOVERY_NUDGE: ChatMessage = {
  role: 'user',
  content: 'Your previous reply arrived but could not be read: it did not match the required '
    + 'response shape. Answer the same question again, replying with ONLY the JSON object of '
    + 'the shape described, nothing before or after it.',
};

/**
 * One heard voice with its speaker.
 *
 * @example
 * ```ts
 * const voice: HeardVoice<CriticReportWire> = { modelId, value: report, };
 * ```
 */
export type HeardVoice<ValueT,> = {
  /**
   * Model that answered.
   */
  readonly modelId: RosterModelId;

  /**
   * Validated reply value.
   */
  readonly value: ValueT;
};

/**
 * Everything a quorum gather produced.
 *
 * @example
 * ```ts
 * const { voices, quorumMet, } = await gatherStageVoices({ ... },);
 * ```
 */
export type StageGather<ValueT,> = {
  /**
   * Heard voices in arrival-round then roster order.
   */
  readonly voices: readonly HeardVoice<ValueT>[];

  /**
   * Whether at least half the roster, rounded up, was heard.
   */
  readonly quorumMet: boolean;

  /**
   * Degradation findings in scorecard-stable wording;
   * empty when quorum was met.
   */
  readonly findings: readonly string[];
};

/**
 * Fans one prompt out to a roster and retries lost voices to quorum.
 * Each round re-asks only the still-lost models on fresh deadlines;
 * the loop stops as soon as half the roster, rounded up, is heard, and
 * otherwise ends when the retry rounds are spent.
 *
 * @param client - injected model client
 *
 * @param modelIds - stage roster
 *
 * @param messages - prompt shared by every voice
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param exchangeTimeoutMs - deadline per exchange
 *
 * @param maxAnswerChars - bound on one answer, when the caller knows how
 * large its own input was
 *
 * @param responseFormat - structured-output constraint
 *
 * @param validate - client-side schema guard
 *
 * @param stage - stage label for logging and findings
 *
 * @param l - logger of the calling stage
 *
 * @param maxRetryRounds - rounds after the initial fan-out;
 * defaults to {@link STAGE_RETRY_ROUNDS}
 *
 * @param graceMs - window a straggler gets after quorum before the round
 * abandons it; defaults to `STRAGGLER_GRACE_MS` and exists so a test can bound
 * its own wall time
 *
 * @returns Heard voices plus quorum verdict and degradation findings
 *
 * @example
 * ```ts
 * const gather = await gatherStageVoices({ ..., stage: 'critic', l, },);
 * ```
 */
export async function gatherStageVoices<ValueT,>(
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
    maxRetryRounds = STAGE_RETRY_ROUNDS,
    graceMs,
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
    readonly maxRetryRounds?: number;
    readonly graceMs?: number;
  }>,
): Promise<StageGather<ValueT>> {
  /**
   * Voices a quorum needs: at least half the roster, rounded up.
   *
   * Was "strictly more than half", which differs only on EVEN rosters and was
   * costing a round there. At six models the old rule demanded 4 while this
   * demands 3; at seven both demand 4, so odd rosters are unaffected. User
   * decision 2026-08-05, taken when the roster shrank to six: exactly half of
   * an even panel is a quorum.
   */
  const quorumNeeded = rosterQuorumSize({ rosterSize: modelIds.length, },);

  /**
   * Heard voices accumulated across rounds;
   * the round cursor lives inside the named IIFE so its mutation never
   * leaks into the surrounding scope.
   */
  const voices: readonly HeardVoice<ValueT>[] = await (async function collectRounds(): Promise<
    readonly HeardVoice<ValueT>[]
  > {
    /**
     * Voices collected so far.
     */
    const collected: HeardVoice<ValueT>[] = [];

    /**
     * Everything a round needs except who to ask and how many to wait for.
     *
     * Hoisted so the recovery round below cannot drift from the quorum rounds
     * above: they differ in exactly two fields, and writing the other ten twice
     * is how the two would eventually disagree about a deadline or a guard.
     */
    const fanOut = {
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

    /**
     * Models still owing a reply.
     */
    let pending: readonly RosterModelId[] = modelIds;

    /**
     * Models whose last loss was an answer nothing could read, in roster order.
     *
     * SEPARATE FROM `pending`, because the two are re-asked for opposite
     * reasons. A pending model is one quorum still NEEDS. One of these is a
     * model quorum does not need and whose voice is recoverable anyway, since
     * it reached the end of its work and only the shape defeated the guard.
     */
    let unreadable: readonly RosterModelId[] = [];
    for (let round = 0; round <= maxRetryRounds; round += 1) {
      if (pending.length === 0)
        break;
      if ((round > 0) && (collected.length >= quorumNeeded))
        break;
      if (round > 0) {
        l.warn(
          `${stage}: retry round ${String(round,)} for ${String(pending.length,)} lost voices`,
        );
      }

      /* oxlint-disable no-await-in-loop -- rounds are sequential by design: each round re-asks only the voices the previous round lost */
      /**
       * This round's outcomes, one per still-pending model, with anything still
       * in flight a grace period after quorum abandoned rather than waited on.
       */
      const outcomes = await runGatherRound<ValueT>({
        ...fanOut,
        modelIds: pending,
        heardNeeded: quorumNeeded - collected.length,
      },);
      /* oxlint-enable no-await-in-loop */

      /**
       * Models this round still lost.
       */
      const stillLost: RosterModelId[] = [];

      /**
       * Models this round lost to an answer nothing could read.
       */
      const answeredBadly: RosterModelId[] = [];
      for (const outcome of outcomes) {
        if (outcome.voice
          .heard) {
          collected.push({
            modelId: outcome.modelId,
            value: outcome.voice
              .value,
          },);
          continue;
        }
        stillLost.push(outcome.modelId,);
        if (outcome.voice
          .answered)
          answeredBadly.push(outcome.modelId,);
      }
      pending = stillLost;
      unreadable = answeredBadly;
    }

    // ONE RECOVERY ROUND, OUTSIDE THE QUORUM LOOP AND AFTER IT.
    //
    // The loop above stops the moment quorum stands, which is correct for what
    // it is for and is why nothing it re-asks has ever been re-asked: measured
    // over 109 rounds of a ten-model roster on 2026-08-25, the first fan-out
    // met quorum every time, 1054 voices of 1090 were heard, 31 rounds lost at
    // least one, and zero retry rounds ran.
    //
    // Thirteen of those 36 losses were the model ANSWERING in a shape nothing
    // could read, spread over 7 distinct slices of 15 with at most 2 on any
    // one, so no input reliably breaks a model. The other 23 were silence,
    // which `doc/audit/where-a-round-spends-its-wall-clock.md` measures to be a
    // model still thinking. Re-asking both would spend the expensive half to
    // recover the cheap half, so only the answered half is re-asked here.
    //
    // ONE ROUND, NEVER A LADDER. A model that formats badly twice is telling us
    // something about itself rather than about the weather, and the calibration
    // is what answers that.
    if (unreadable.length > 0) {
      l.warn(
        `${stage}: recovery round for ${String(unreadable.length,)} unreadable answers`,
      );

      /**
       * Second reading of the voices that finished but could not be read.
       *
       * NEEDING NONE OF THEM IS THE BOUND. Quorum already stands, so this round
       * is entitled to no more than a straggler window: `heardNeeded: 0` leaves
       * `runGatherRound` with nothing to wait for, which opens the grace window
       * at once and abandons whatever has not arrived when it closes. Asking
       * for all of them instead would let one re-ask that hangs hold the whole
       * gather for a full exchange deadline, which is six minutes in a run and
       * the opposite of what a recovery is for.
       *
       * A voice that comes back promptly is still collected: the window
       * resolves as soon as every ask settles.
       */
      const recovered = await runGatherRound<ValueT>({
        ...fanOut,
        // A DIFFERENT PROMPT, OR THE ROUND BUYS NOTHING. `promptUniqueClient`
        // serves a second call for the same model and prompt from its cache,
        // schema mismatch included, so re-sending the same bytes came back with
        // the same unreadable answer in 0 to 1 ms every time it was measured
        // (`#473`, five recovery rounds over two passes on 2026-09-02). The
        // nudge tells the model what happened and makes the digest new.
        messages: [
          ...messages,
          RECOVERY_NUDGE,
        ],
        modelIds: unreadable,
        heardNeeded: 0,
      },);

      for (const outcome of recovered) {
        if (outcome.voice
          .heard) {
          collected.push({
            modelId: outcome.modelId,
            value: outcome.voice
              .value,
          },);
        }
      }
    }
    return collected;
  })();

  /**
   * Whether at least half the roster, rounded up, ended up heard.
   */
  const quorumMet = voices.length >= quorumNeeded;

  /**
   * Roster shortfall wording shared by both degradation findings.
   */
  const shortfall = `${stage} ${String(voices.length,)}/${String(modelIds.length,)}`;

  /**
   * Models that never answered, in roster order.
   */
  const unheard = modelIds.filter(function neverHeard(modelId,): boolean {
    return !voices.some(function isVoice(voice,): boolean {
      return voice.modelId === modelId;
    },);
  },);

  /**
   * Naming of every model that went quiet, which the ARTIFACT carries and a
   * log line does not.
   *
   * Voice loss reached only `l.warn` before this. That made every question
   * about it, which model, which stage, how often, answerable solely from a
   * captured run log, and on 2026-08-13 a run spent twenty minutes writing its
   * log into a pipe whose reader had exited: the losses happened and nothing
   * recorded them. Findings travel into the per-entry artifact, which is
   * written durably and survives whatever spawned the pass.
   *
   * Emitted even when quorum was MET, which is the case the old findings
   * dropped entirely and the one that hides a model degrading quietly while
   * the stage still looks healthy.
   *
   * ONE FINDING PER MODEL rather than one naming a list, so counting the
   * findings counts voices lost. A list-valued finding counts GATHERS that
   * lost at least one voice, which is a different number, and reading the
   * first as the second is the mistake that made the earlier per-model tally
   * unusable: it summed to 113 mentions over 97 lines and was reported as
   * though it were events.
   */
  const lostFindings: readonly string[] = unheard.map(function toFinding(modelId,): string {
    return `stage-voice-lost (${stage} ${modelId})`;
  },);

  if (!quorumMet) {
    return {
      voices,
      quorumMet,
      findings: [
        ...lostFindings,
        stageQuorumUnmetFinding({ shortfall, },),
      ],
    };
  }
  // Emitted whenever the roster ended short, not only when retries were still
  // chasing it. The ratio is the part per-model loss findings cannot carry, and
  // a stage that met quorum with a voice missing is exactly the case that reads
  // as healthy everywhere else.
  if (voices.length < modelIds.length) {
    return {
      voices,
      quorumMet,
      findings: [
        ...lostFindings,
        `stage-roster-incomplete (${shortfall})`,
      ],
    };
  }
  return {
    voices,
    quorumMet,
    findings: lostFindings,
  };
}

//endregion Stage quorum
