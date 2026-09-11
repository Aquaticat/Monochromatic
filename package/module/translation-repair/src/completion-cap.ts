import type { RosterModelId, } from './roster-id.ts';

//region Completion cap
// EVERY CALL ON EVERY PROVIDER CARRIES `max_tokens` SINCE 2026-09-09. The
// per-token provider got it first that morning, at a table keyed by its own
// served ids: between the top-up of 2026-09-08 11:27 UTC and the payment
// refusal of 2026-09-09 12:22 UTC the meter spent 199.92 USD, of which the
// `SPEND` lines accounted for 141.62, and the rest was streams the rounds had
// abandoned 120 s after quorum that the endpoints kept generating and billing
// to their own end. The same afternoon the owner said not to ignore that
// whatever is sent to Hyper and Synthetic more efficiently makes those last
// longer, so fewer calls fall back to the per-token provider at all: Synthetic
// meters a weekly token allowance (`synthetic-quota.ts`), Hyper a daily
// limit, Bedrock a credit the owner will never top up, and a runaway reply
// spends every one of them. So the table is keyed by roster id and every
// client sends it.
//
// MEASURED, NOT CHOSEN. Over every `SPEND` line in the pass logs under
// `~/temp/agent` as of 2026-09-09 16:20 UTC (142,437 completed calls across
// the four providers; `cap-measure-20260909.txt` beside them holds the
// table), each cap is the highest 99th percentile of `completion_tokens`
// that any provider with at least 100 calls of the model recorded, so a
// model is never cut on one provider at a length another provider's
// tokenizer counts higher; floored at the pooled 90th percentile (3,831) so a
// seat whose replies are mostly short verdicts is never cut on the long
// answer a writer seat asks of it. Every cap cuts under one percent of that
// model's completed calls; `minimax-m3` the most, 274 of 34,018, since its
// Hyper replies ran to the 32,000 ceiling that provider already enforced.
//
// NOT A THINKING PARAMETER. The owner's standing instruction of 2026-08-25
// ("don't set any thinking parameter or budget tokens") is about reasoning
// controls, which stay off the wire; `max_tokens` is the ordinary output
// ceiling every endpoint takes, and the owner's instruction of 2026-09-09,
// "do everything in our power to NOT bleed", is what puts it on. A reply
// that meets the cap ends `finish_reason=length`, which
// `chat-json-outcome.ts` already reads as a truncated voice. Hyper keeps its
// own per-model ceiling (`answerCeilingFor`) and takes the lower of the two.
//
// A MODEL THE MEASUREMENT HOLDS NO COMPLETED CALL FOR takes the pooled 99th
// percentile (13,082) until its own calls are read, as Mercury 2.5 did
// between its seating and 20:05 UTC on 2026-09-09.

/**
 * Pooled 90th percentile of completion tokens over every completed call in
 * the measurement, the floor under a model's own cap.
 */
const POOLED_P90 = 3_831;

/**
 * Existing pooled 99th percentile for a new model without its own completed-call distribution.
 */
const POOLED_P99 = 13_082;

/**
 * Completion token ceiling per roster model, sent as `max_tokens` by every
 * client.
 *
 * @example
 * ```ts
 * const cap = COMPLETION_CAP['deepseek-v4-pro-0813'];
 * ```
 */
export const COMPLETION_CAP: Readonly<Record<RosterModelId, number>> = {
  // Hyper p99 over 886 calls; Synthetic 16,342 over 4,775; OpenRouter 13,070
  // over 1,853.
  'hf:zai-org/GLM-5.3-Flash': 18_316,
  // Synthetic p99 over 7,312 calls; OpenRouter 11,127 over 4,538; Hyper
  // 10,541 over 1,921.
  'hf:Qwen/Qwen3.8-27B': 20_894,
  // Hyper p99 over 2,777 calls; OpenRouter 8,254 over 488; Synthetic 4,350
  // over 7,051.
  'hf:moonshotai/Kimi-K3': 10_921,
  // Own p99 at most 3,649 (Hyper, 2,479 calls) over 21,111 calls on four
  // providers, under the pooled 90th.
  'hf:openai/gpt-oss-120b': POOLED_P90,
  // Hyper p99 over 27,361 calls; OpenRouter 718 over 6,657.
  'minimax-m3': 10_822,
  // Own p99 at most 483 over 16,251 calls on three providers, under the
  // pooled 90th.
  'gemma-4-26b-a4b-it': POOLED_P90,
  // OpenRouter p99 over 6,576 calls; Hyper 1,918 over 8,618.
  'deepseek-v4-pro-0813': 9_128,
  // OpenRouter p99 over 4,915 calls; Hyper 661 over 7,700.
  'deepseek-v4-flash-0731': 16_543,
  // New version, approved 2026-09-11. Use the existing unmeasured-model policy,
  // not V4 Flash 0731's distribution or a provider's advertised maximum.
  'deepseek-v4.1-flash': POOLED_P99,
  // OpenRouter p99 over 2,673 calls; Hyper 17,118 over 3,343.
  'glm-5.3': 22_067,
  // Own p99 483 over 5,506 Bedrock calls, under the pooled 90th.
  'google.gemma-4-e2b': POOLED_P90,
  // Bedrock p99 over 125 calls, the thinnest measurement in the table.
  'google.gemma-4-31b': 8_194,
  // Own p99 3,063 over 136 OpenRouter calls (Inception, its one endpoint)
  // read 2026-09-09 20:05 UTC across the fidelity probes, the producer
  // calibration and the seventh `Mio` pass, max 3,127, none abandoned, under
  // the pooled 90th.
  'inception/mercury-2.5': POOLED_P90,
};

/**
 * Ceiling one call carries: the measured cap, or a caller's own when lower.
 *
 * @param modelId - roster model the call is for
 *
 * @param requested - caller's ceiling, which only ever lowers the cap
 *
 * @returns Value for the request body's `max_tokens`
 *
 * @example
 * ```ts
 * const maxTokens = completionCapFor({ modelId: 'minimax-m3', requested: 500, },);
 * ```
 */
export function completionCapFor(
  {
    modelId,
    requested,
  }: {
    readonly modelId: RosterModelId;
    readonly requested?: number;
  },
): number {
  /**
   * Measured ceiling for this model.
   */
  const cap = COMPLETION_CAP[modelId];
  if (requested === undefined)
    return cap;
  return Math.min(
    requested,
    cap,
  );
}

//endregion Completion cap
