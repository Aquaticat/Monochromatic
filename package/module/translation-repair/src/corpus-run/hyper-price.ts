//region Hyper price
// WHAT A CHARM HYPER TOKEN COSTS, as of the date this table was read.
//
// PRICES ARE AN OBSERVATION, NOT A CONSTANT. The operator read these off the
// provider's own model page and pasted them in on the date `HYPER_PRICE_READ_ON`
// names. A provider changes them whenever it likes, and a stale table reports a
// confident wrong number rather than refusing, so the date ships beside the
// rates and every report prints it. Re-read the page and update both together.
//
// CREDITS PER MILLION TOKENS, which is how the provider quotes them. Output is
// two to five times input across this roster and `completion_tokens` counts
// thinking, which dominates output on these models, so the answer half is the
// expensive half and it is not the visible half.
//
// THE TWO CACHE COLUMNS ARE UNREACHABLE FOR THIS PIPELINE, and are carried
// anyway. Nothing in this package sends `cache_control`, which is checkable in
// one grep over `package/module/translation-repair/src`, so on the Anthropic
// protocol Hyper speaks there are no cache-creation and no cache-read tokens
// and every input token bills at the plain input rate. That makes the input
// half EXACT rather than an upper bound. The rates sit here so that whoever
// turns caching on finds them already recorded rather than having to go back to
// the page, and so that a reader can see what the saving would be worth.
//
// SYNTHETIC IS NOT PRICED HERE AND MUST NOT BE. It is a flat subscription whose
// meter is a percentage of a weekly allowance, already carried on the `METERS`
// line. Converting its tokens to credits would invent a currency it does not
// bill in and would inflate any total that mixed the two.

/**
 * Date the rates below were read off the provider's model page.
 *
 * SHIPPED WITH THE RATES rather than left to a comment, because every report
 * that prints a credit figure has to be able to say how old it is.
 */
export const HYPER_PRICE_READ_ON = '2026-08-26';

/**
 * What one model costs, in credits per million tokens.
 *
 * @example
 * ```ts
 * const rates: CreditRates = { input: 40, output: 120, cacheCreate: 0, cacheHit: 5, };
 * ```
 */
export type CreditRates = {
  /**
   * Credits per million prompt tokens that were not served from cache.
   */
  readonly input: number;

  /**
   * Credits per million completion tokens, thinking included.
   */
  readonly output: number;

  /**
   * Credits per million tokens written into the cache.
   *
   * UNREACHABLE WHILE THIS PACKAGE SENDS NO `cache_control`.
   */
  readonly cacheCreate: number;

  /**
   * Credits per million prompt tokens served from the cache.
   *
   * UNREACHABLE WHILE THIS PACKAGE SENDS NO `cache_control`.
   */
  readonly cacheHit: number;
};

/**
 * Tokens one quoted rate covers, since the provider quotes per million.
 */
const RATE_UNIT_TOKENS = 1_000_000;

/**
 * Every model the provider listed, by the id it serves the model under.
 *
 * THE WHOLE PAGE RATHER THAN THE EIGHT THIS PIPELINE SEATS, so that changing
 * the roster does not silently drop a seat into the unpriced bucket, and so a
 * reader comparing seats can see what an unseated model would have cost.
 */
const HYPER_CREDIT_RATES: Readonly<Record<string, CreditRates>> = {
  'deepseek-v4-flash': {
    input: 4,
    output: 8,
    cacheCreate: 0,
    cacheHit: 0.8,
  },
  'deepseek-v4-flash-0731': {
    input: 8.8,
    output: 26.4,
    cacheCreate: 0,
    cacheHit: 0.88,
  },
  'deepseek-v4-pro': {
    input: 48,
    output: 96,
    cacheCreate: 0,
    cacheHit: 4,
  },
  'deepseek-v4-pro-0813': {
    input: 28.74,
    output: 86.23,
    cacheCreate: 0,
    cacheHit: 0.96,
  },
  'gemma-4-26b-a4b-it': {
    input: 2.4,
    output: 8.4,
    cacheCreate: 1.2,
    cacheHit: 0,
  },
  'glm-5': {
    input: 18.4,
    output: 59.52,
    cacheCreate: 9.2,
    cacheHit: 0,
  },
  'glm-5.1': {
    input: 25.8,
    output: 84.4,
    cacheCreate: 12.9,
    cacheHit: 0,
  },
  'glm-5.2': {
    input: 30.49,
    output: 95.81,
    cacheCreate: 0,
    cacheHit: 3.05,
  },
  'gpt-oss-120b': {
    input: 3.56,
    output: 13.6,
    cacheCreate: 1.78,
    cacheHit: 0,
  },
  'kimi-k2.5': {
    input: 10.88,
    output: 55.2,
    cacheCreate: 5.44,
    cacheHit: 0,
  },
  'kimi-k2.6': {
    input: 20.69,
    output: 87.1,
    cacheCreate: 0,
    cacheHit: 3.48,
  },
  'kimi-k2.7-code': {
    input: 20.69,
    output: 87.1,
    cacheCreate: 0,
    cacheHit: 4.14,
  },
  'kimi-k3': {
    input: 65.33,
    output: 326.64,
    cacheCreate: 0,
    cacheHit: 6.53,
  },
  'llama-3.3-70b-instruct': {
    input: 12.76,
    output: 15.36,
    cacheCreate: 6.38,
    cacheHit: 0,
  },
  'llama-4-maverick-17b-128e-instruct-fp8': {
    input: 5.48,
    output: 17.98,
    cacheCreate: 2.74,
    cacheHit: 0,
  },
  'minimax-m2.7': {
    input: 8.48,
    output: 32.24,
    cacheCreate: 4.24,
    cacheHit: 0,
  },
  'minimax-m3': {
    input: 6.53,
    output: 26.13,
    cacheCreate: 0,
    cacheHit: 1.28,
  },
  'qwen3-coder-480b-a35b-instruct-int4-mixed-ar': {
    input: 8.9,
    output: 42.9,
    cacheCreate: 4.45,
    cacheHit: 0,
  },
  'qwen3-next-80b-a3b-instruct': {
    input: 2.35,
    output: 22.72,
    cacheCreate: 1.17,
    cacheHit: 0,
  },
  'qwen3.6-flash': {
    input: 20,
    output: 80,
    cacheCreate: 25,
    cacheHit: 2,
  },
  'qwen3.6-max': {
    input: 40,
    output: 240,
    cacheCreate: 50,
    cacheHit: 4,
  },
  'qwen3.6-plus': {
    input: 40,
    output: 120,
    cacheCreate: 50,
    cacheHit: 4,
  },
  'qwen3.7-flash': {
    input: 4,
    output: 16,
    cacheCreate: 0,
    cacheHit: 0.8,
  },
  'qwen3.7-max': {
    input: 50,
    output: 150,
    cacheCreate: 0,
    cacheHit: 10,
  },
  'qwen3.7-plus': {
    input: 24,
    output: 96,
    cacheCreate: 0,
    cacheHit: 4.8,
  },
  'qwen3.8-2.4t-a95b': {
    input: 40,
    output: 120,
    cacheCreate: 0,
    cacheHit: 5,
  },
  'qwen3.8-27b': {
    input: 10,
    output: 60,
    cacheCreate: 0,
    cacheHit: 2,
  },
  'qwen3.8-flash': {
    input: 3.2,
    output: 9.4,
    cacheCreate: 0,
    cacheHit: 0.32,
  },
  'qwen3.8-max': {
    input: 40,
    output: 120,
    cacheCreate: 0,
    cacheHit: 5,
  },
};

/**
 * Rates keyed for lookup by a model id that came off a log line.
 *
 * A `Map` RATHER THAN THE LITERAL ABOVE, for the reason `spend-read.ts` gives
 * about its own field table: the key arrives from a run log, and an object
 * lookup would answer `__proto__` and `constructor` with something that is not
 * a rate. The literal stays an object because it is written here and reads
 * better as one.
 */
const RATES: ReadonlyMap<string, CreditRates> = new Map(Object.entries(HYPER_CREDIT_RATES,),);

/**
 * What this model costs, or that the table has never heard of it.
 *
 * NAMED ABSENCE RATHER THAN A ZERO RATE. A model the provider added after this
 * table was read is not free, and a total that quietly billed it at nothing
 * would read as a cheaper run rather than an incomplete one.
 *
 * @param model - id as the provider serves it, exactly as the `SPEND` line
 * recorded it
 *
 * @returns Rates for this model, or that it is not in the table
 *
 * @example
 * ```ts
 * const rates = ratesFor({ model: 'qwen3.8-max', },);
 * ```
 */
export function ratesFor(
  { model, }: { readonly model: string; },
): CreditRates | 'unpriced' {
  /**
   * Row this model has, absent where the table predates it.
   */
  const found = RATES.get(model,);

  if (found === undefined)
    return 'unpriced';

  return found;
}

/**
 * Prices one seat's tokens, keeping the two halves apart.
 *
 * BOTH HALVES RETURNED, not just their sum, because the output half is where
 * this roster's cost actually lives and a single total hides which seat's
 * thinking bought it.
 *
 * @param model - id as the provider serves it
 *
 * @param promptTokens - prompt tokens summed over this seat's reported calls
 *
 * @param completionTokens - completion tokens summed over the same calls,
 * thinking included
 *
 * @returns Credits for each half, or that this model is not in the table
 *
 * @example
 * ```ts
 * const cost = creditsFor({ model: 'kimi-k3', promptTokens: 84_000, completionTokens: 51_065, },);
 * ```
 */
export function creditsFor(
  {
    model,
    promptTokens,
    completionTokens,
  }: {
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
  },
): {
  readonly inputCredits: number;
  readonly outputCredits: number;
} | 'unpriced' {
  /**
   * Rates this model bills at, absent where the table has no row.
   */
  const rates = ratesFor({ model, },);

  if (rates === 'unpriced')
    return 'unpriced';

  return {
    inputCredits: (promptTokens * rates.input) / RATE_UNIT_TOKENS,
    outputCredits: (completionTokens * rates.output) / RATE_UNIT_TOKENS,
  };
}

//endregion Hyper price
