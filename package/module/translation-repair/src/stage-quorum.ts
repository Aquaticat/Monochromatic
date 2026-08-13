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
// forfeiting voices cheaply leaves capacity unused). The retry target
// depends on what the stage produces: VOTING stages stop at quorum because
// a majority is a majority, while UNION stages retry to the full roster
// because their product shrinks with every unheard voice. A roster still
// short after every round proceeds with what it has and records the
// degradation as a finding.
//
// WHICH STAGE IS WHICH is not the obvious split, and this comment stated it
// wrongly until 2026-08-13. `full-roster` is passed by the EDITOR and
// REFINER stages only. The CRITIC stage takes the `quorum` default, despite
// being a union stage whose convergence is low (67 to 84 percent singleton
// issues across real-corpus artifacts). That is deliberate: full-roster
// retries for critics were tried and REVERTED by user decision on
// 2026-07-23, because critics answered 7/7 on the first round nearly
// always, slicing and panel-judged merging carry the thoroughness burden,
// and waiting on a complete roster stalls a run when a voice wedges. The
// reasoning lives at the call site in `repair-stages.ts`.
//
// The premise is worth re-checking rather than inheriting: on a SIX-model
// roster `pass13` finished the critic stage one voice short on 18.6% of
// invocations, which is not "7/7 nearly always". Recorded in `#75`.

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
 * Fans one prompt out to a roster and retries lost voices to the stage's
 * retry target.
 * Each round re-asks only the still-lost models on fresh deadlines;
 * under `quorum` the loop stops as soon as half the roster, rounded up, is heard,
 * under `full-roster` it keeps re-asking while any voice is missing, and
 * either way it ends when the retry rounds are spent.
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
 * @param retryTarget - when retries may stop: `quorum` for voting stages
 * whose majority suffices, `full-roster` for union stages whose product
 * shrinks with every unheard voice; defaults to `quorum`
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
    retryTarget = 'quorum',
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
    readonly retryTarget?: 'quorum' | 'full-roster';
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
      if (
        (round > 0)
        && (retryTarget === 'quorum')
          && (collected.length >= quorumNeeded)
      ) {
        break;
      }
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
  if (!quorumMet) {
    return {
      voices,
      quorumMet,
      findings: [`stage-quorum-unmet (${shortfall})`,],
    };
  }
  if ((retryTarget === 'full-roster') && (voices.length < modelIds.length)) {
    return {
      voices,
      quorumMet,
      findings: [`stage-roster-incomplete (${shortfall})`,],
    };
  }
  return {
    voices,
    quorumMet,
    findings: [],
  };
}

//endregion Stage quorum
