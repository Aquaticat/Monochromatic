import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import { attemptStageCall, } from './stage-call.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

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
  readonly modelId: SyntheticModelId;

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
    responseFormat,
    validate,
    stage,
    l,
    maxRetryRounds = STAGE_RETRY_ROUNDS,
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
    readonly maxRetryRounds?: number;
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
  const quorumNeeded = Math.ceil(modelIds.length / 2,);

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
     * Models still owing a reply.
     */
    let pending: readonly SyntheticModelId[] = modelIds;
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
       * This round's outcomes, one per still-pending model.
       */
      const outcomes = await Promise.all(pending.map(async function askOnce(modelId,) {
        return {
          modelId,
          voice: await attemptStageCall({
            client,
            modelId,
            messages,
            signal,
            exchangeTimeoutMs,
            responseFormat,
            validate,
            stage,
            l,
          },),
        };
      },),);
      /* oxlint-enable no-await-in-loop */

      /**
       * Models this round still lost.
       */
      const stillLost: SyntheticModelId[] = [];
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
      }
      pending = stillLost;
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
        `stage-quorum-unmet (${shortfall})`,
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
