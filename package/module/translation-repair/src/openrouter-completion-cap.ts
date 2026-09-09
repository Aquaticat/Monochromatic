import type { OpenRouterServedId, } from './openrouter-catalog.ts';

//region OpenRouter completion cap
// EVERY OPENROUTER CALL CARRIES `max_tokens` SINCE 2026-09-09. Between the
// top-up of 2026-09-08 11:27 UTC and the payment refusal of 2026-09-09 12:22
// UTC the meter spent 199.92 USD, of which the `SPEND` lines account for
// 141.62. The rest was streams the rounds abandoned 120 s after quorum:
// 2,135 of them, and OpenRouter's own streaming page lists CoreWeave, Wafer,
// Parasail, Phala and Modal among neither the providers that stop billing on a
// cancelled stream nor those that do, while Alibaba and MiniMax are listed as
// billing the complete response. A stream this pipeline stopped reading kept
// being generated and paid for, up to 8 MB of raw stream for one JSON
// verdict. A ceiling the provider enforces is the one bound that holds on
// every endpoint.
//
// MEASURED, NOT CHOSEN. Each cap is the 99th percentile of `completion_tokens`
// over that model's completed OpenRouter calls in that window (20,492 calls
// across the pass logs under `~/temp/agent`), so one call in a hundred that
// finished would have been cut, and every runaway is cut at what a finished
// call needed. Two floors: a model whose own 99th percentile sits under the
// pooled 90th (6,232) takes the pooled 90th, so a seat whose replies are
// mostly short JSON verdicts is never cut on the long answer a writer seat
// asks of it; a model with no completed OpenRouter call in the window takes
// the pooled 99th (14,454). The measurement is in the planning log of
// 2026-09-09, "The owner asks where 200 USD went".
//
// NOT A THINKING PARAMETER. The owner's standing instruction of 2026-08-25
// ("don't set any thinking parameter or budget tokens") is about reasoning
// controls, which stay off the wire; `max_tokens` is the ordinary output
// ceiling every OpenAI-compatible endpoint takes, and the owner's instruction
// of 2026-09-09, "do everything in our power to NOT bleed", is what puts it
// on. A reply that meets the cap ends `finish_reason=length`, which
// `chat-json-outcome.ts` already reads as a truncated voice.

/**
 * Pooled 90th percentile of completion tokens over every completed OpenRouter
 * call in the measurement window, the floor under a model's own cap.
 */
const POOLED_P90 = 6_232;

/**
 * Pooled 99th percentile over the same calls, the cap for a model the window
 * holds no completed call for.
 */
const POOLED_P99 = 14_454;

/**
 * Completion token ceiling per served model, sent as `max_tokens`.
 *
 * @example
 * ```ts
 * const cap = OPENROUTER_COMPLETION_CAP['deepseek/deepseek-v4-pro-0813'];
 * ```
 */
export const OPENROUTER_COMPLETION_CAP: Readonly<Record<OpenRouterServedId, number>> = {
  // 442 completed calls, p99 8,254.
  'moonshotai/kimi-k3': 8_254,
  // 4,807 completed calls, p99 677, under the pooled 90th.
  'minimax/minimax-m3': POOLED_P90,
  // 3,660 completed calls, p99 17,123.
  'deepseek/deepseek-v4-flash-0731': 17_123,
  // 4,835 completed calls, p99 9,203.
  'deepseek/deepseek-v4-pro-0813': 9_203,
  // 1,425 completed calls, p99 11,882.
  'z-ai/glm-5.3-flash': 11_882,
  // 5 completed calls in the window, too few to read a percentile off.
  'google/gemma-4-26b-a4b-it': POOLED_P99,
  // No completed OpenRouter call in the window: Bedrock served the seat.
  'openai/gpt-oss-120b': POOLED_P99,
};

/**
 * Ceiling one call carries: the measured cap, or a caller's own when lower.
 *
 * @param servedId - model as this provider spells it
 *
 * @param requested - caller's ceiling, which only ever lowers the cap
 *
 * @returns Value for the request body's `max_tokens`
 *
 * @example
 * ```ts
 * const maxTokens = completionCapFor({ servedId: 'minimax/minimax-m3', requested: 500, },);
 * ```
 */
export function completionCapFor(
  {
    servedId,
    requested,
  }: {
    readonly servedId: OpenRouterServedId;
    readonly requested?: number;
  },
): number {
  /**
   * Measured ceiling for this model.
   */
  const cap = OPENROUTER_COMPLETION_CAP[servedId];
  if (requested === undefined)
    return cap;
  return Math.min(
    requested,
    cap,
  );
}

//endregion OpenRouter completion cap
