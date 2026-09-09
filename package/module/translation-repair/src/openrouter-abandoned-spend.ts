import type { TransportReply, } from './synthetic-transport.ts';
import {
  OPENROUTER_MODELS,
  type OpenRouterServedId,
} from './openrouter-catalog.ts';
import { reportSpend, } from './spend-line.ts';
import { StreamCutShortError, } from './stream-cut.ts';
import { StreamOverrunError, } from './stream-overrun.ts';
import { StreamDegenerateError, } from './stream-runaway-watch.ts';

//region OpenRouter abandoned spend
// A STREAM THIS PIPELINE STOPPED READING WAS STILL PAID FOR, and until
// 2026-09-09 nothing wrote that down. `SPEND` lines are written off the usage
// block of a completed stream, so a round's straggler cut, a stall, an overrun
// or a degenerate ending left no line at all, and the log summed 141.62 USD
// where the meter had moved 199.92 between the top-up of 2026-09-08 and the
// refusal of 2026-09-09. The missing 58 were 2,135 abandoned streams.
//
// ESTIMATED, AND SAID SO. The wire reports cost only at the end, so an
// abandoned call's cost is reconstructed: completion tokens from the raw
// stream characters delivered at each model's measured ratio, prompt tokens
// from the request body's bytes, both priced at the listing's rates. The line
// carries `estimated=abandoned` so a reader can total it beside the reported
// lines or apart from them. The estimate over-reads a stream on an endpoint
// that honoured the cancel and under-reads one that generated on past the cut,
// which is why the ceiling in `completion-cap.ts` is the bound and
// this is the record.

/**
 * Raw stream characters per completion token, the 50th percentile over every
 * completed OpenRouter stream of 2026-09-09 whose progress line sat beside
 * its spend line (pass logs under `~/temp/agent`). Framing differs by
 * endpoint, which is why one model reads three times another.
 */
const RAW_CHARS_PER_COMPLETION_TOKEN: Readonly<Record<OpenRouterServedId, number>> = {
  // 340 streams.
  'moonshotai/kimi-k3': 137,
  // 4,015 streams.
  'minimax/minimax-m3': 137,
  // 3,017 streams.
  'deepseek/deepseek-v4-flash-0731': 132,
  // 4,064 streams.
  'deepseek/deepseek-v4-pro-0813': 386,
  // 1,253 streams.
  'z-ai/glm-5.3-flash': 297,
  // Unmeasured on this provider; the median of the measured seats.
  'google/gemma-4-26b-a4b-it': 137,
  // Unmeasured on this provider; the median of the measured seats.
  'openai/gpt-oss-120b': 137,
  // Unmeasured; the median of the measured seats.
  'inception/mercury-2.5': 137,
};

/**
 * Request body bytes per prompt token, an order-of-magnitude figure for a
 * body that is mostly UTF-8 Chinese at three bytes a character and English
 * sheet text at one; the prompt half of an abandoned call is the smaller half
 * and this is labelled an estimate.
 */
const PROMPT_BYTES_PER_TOKEN = 4;

/**
 * Tokens in one million, the unit the listing prices in.
 */
const TOKENS_PER_MILLION = 1_000_000;

/**
 * Reads what an abandoned stream had delivered off the error that ended it.
 *
 * @param error - whatever the exchange threw
 *
 * @returns Raw characters delivered, or that the error says nothing about it
 *
 * @example
 * ```ts
 * const delivered = deliveredCharsOf({ error, },);
 * ```
 */
export function deliveredCharsOf(
  { error, }: { readonly error: unknown; },
): number | 'nothing-known' {
  if (error instanceof StreamCutShortError) {
    /**
     * Text the cut stream had delivered.
     */
    const { partialText, } = error;
    return partialText.length;
  }
  if (error instanceof StreamOverrunError)
    return error.charsSeen;
  if (error instanceof StreamDegenerateError)
    return error.charsSeen;
  return 'nothing-known';
}

/**
 * What an abandoned call is reckoned to have cost.
 *
 * @example
 * ```ts
 * const estimate: AbandonedSpendEstimate = { promptTokens: 1000, completionTokens: 10, usd: 0.0006, };
 * ```
 */
export type AbandonedSpendEstimate = {
  /**
   * Prompt tokens reckoned from the request body's bytes.
   */
  readonly promptTokens: number;

  /**
   * Completion tokens reckoned from the raw characters delivered.
   */
  readonly completionTokens: number;

  /**
   * Both halves at the listing's prices.
   */
  readonly usd: number;
};

/**
 * Reckons an abandoned call's cost from what it delivered and what it sent.
 *
 * @param servedId - model as this provider spells it
 *
 * @param deliveredChars - raw stream characters read before the end
 *
 * @param requestBodyBytes - size of the request body that was sent
 *
 * @returns Token halves and their price
 *
 * @example
 * ```ts
 * const estimate = estimateAbandonedSpend({ servedId, deliveredChars: 3860, requestBodyBytes: 4000, },);
 * ```
 */
export function estimateAbandonedSpend(
  {
    servedId,
    deliveredChars,
    requestBodyBytes,
  }: {
    readonly servedId: OpenRouterServedId;
    readonly deliveredChars: number;
    readonly requestBodyBytes: number;
  },
): AbandonedSpendEstimate {
  /**
   * Listing row carrying this model's prices.
   */
  const info = OPENROUTER_MODELS[servedId];

  /**
   * Completion tokens the delivered characters stand for.
   */
  const completionTokens = Math.round(deliveredChars / RAW_CHARS_PER_COMPLETION_TOKEN[servedId],);

  /**
   * Prompt tokens the body's bytes stand for.
   */
  const promptTokens = Math.round(requestBodyBytes / PROMPT_BYTES_PER_TOKEN,);

  /**
   * Both halves priced.
   */
  const usd = ((promptTokens * info.promptUsdPerMillion) + (completionTokens * info.completionUsdPerMillion))
    / TOKENS_PER_MILLION;
  return {
    promptTokens,
    completionTokens,
    usd,
  };
}

/**
 * Line an abandoned call wrote, or that nothing was written.
 *
 * @example
 * ```ts
 * const report: AbandonedSpendReport = { line: 'SPEND provider=openrouter ...', };
 * ```
 */
export type AbandonedSpendReport =
  | {
    /**
     * Line as logged, in the SPEND grammar with the estimated mark.
     */
    readonly line: string;
  }
  | 'not-reported';

/**
 * Writes the estimated spend line for an abandoned call, where the error says
 * what the stream delivered.
 *
 * @param servedId - model as this provider spells it
 *
 * @param error - whatever the exchange threw
 *
 * @param requestBodyBytes - size of the request body that was sent
 *
 * @returns Line logged in a record, or that the error carried nothing to reckon from
 *
 * @example
 * ```ts
 * const line = reportAbandonedSpend({ servedId, error, requestBodyBytes: 4000, },);
 * ```
 */
export function reportAbandonedSpend(
  {
    servedId,
    error,
    requestBodyBytes,
  }: {
    readonly servedId: OpenRouterServedId;
    readonly error: unknown;
    readonly requestBodyBytes: number;
  },
): AbandonedSpendReport {
  /**
   * Raw characters the stream delivered, when the error says.
   */
  const delivered = deliveredCharsOf({ error, },);
  if (delivered === 'nothing-known')
    return 'not-reported';

  /**
   * What the call is reckoned to have cost.
   */
  const estimate = estimateAbandonedSpend({
    servedId,
    deliveredChars: delivered,
    requestBodyBytes,
  },);
  return {
    line: reportSpend({
      provider: 'openrouter',
      label: servedId,
      extracted: {
        text: '',
        usage: {
          prompt_tokens: estimate.promptTokens,
          completion_tokens: estimate.completionTokens,
        },
      },
      costUsd: estimate.usd,
      estimated: 'abandoned',
    },),
  };
}

/**
 * Performs one exchange, writing the estimated spend line when it fails with
 * a stream that had delivered something, and rethrowing either way.
 *
 * @param servedId - model as this provider spells it
 *
 * @param requestBodyBytes - size of the request body that was sent
 *
 * @param exchange - the transport exchange to perform
 *
 * @returns Whatever the exchange returned
 *
 * @throws Whatever the exchange threw, after the line is written
 *
 * @example
 * ```ts
 * const reply = await exchangeReportingAbandon({ servedId, requestBodyBytes, exchange, },);
 * ```
 */
export async function exchangeReportingAbandon(
  {
    servedId,
    requestBodyBytes,
    exchange,
  }: {
    readonly servedId: OpenRouterServedId;
    readonly requestBodyBytes: number;
    readonly exchange: () => Promise<TransportReply>;
  },
): Promise<TransportReply> {
  try {
    return await exchange();
  }
  catch (error) {
    reportAbandonedSpend({
      servedId,
      error,
      requestBodyBytes,
    },);
    throw error;
  }
}

//endregion OpenRouter abandoned spend
