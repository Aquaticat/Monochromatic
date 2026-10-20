import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type { NeuralWattServedId, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import { PROMPT_BYTES_PER_TOKEN, } from './openrouter-abandoned-spend.ts';

//region NeuralWatt energy estimate
// WHAT A CALL IS EXPECTED TO COST IN ENERGY BEFORE IT IS SENT, for the meter
// that holds it against the day's free allowance.
//
// WHY AN ESTIMATE AT ALL. No endpoint reports what is left of the free daily
// energy, and overage bills the owner's normal plan ("we need to meter (using
// estimations) ourselves because overage eats into my normal plan which I use
// for other stuff", 2026-10-20). A call's true energy is known only when its
// stream ends, in the `: energy` comment (`neuralwatt-comments.ts`). Calls run
// many at a time, so each must hold its expected share of the day the moment
// it is sent, or every call that starts together reads the same remainder and
// the day is spent past its end. The measured figure replaces the estimate at
// settlement (`neuralwatt-ledger.ts`), so this table decides how much is held
// in flight and never how much was spent.
//
// THE FIGURES ARE NEURALWATT'S OWN ENERGY MATRIX, public JSON at
// `https://portal.neuralwatt.com/api/energy-pricing/matrix`, read 2026-10-20
// (`generated_at` 2026-10-20T20:04:27Z, a 7-day window, `Wh_per_request`,
// statistic `mean`, basis `charged`, the standard lane, a minimum of 30
// requests per bucket). The matrix buckets a request by its prompt tokens;
// the bucket edges are the matrix's `min_prompt_tokens` and `max_prompt_tokens`.
// RECALIBRATE FROM THE FIRST RUN: every settled call prints its measured
// figure beside its estimate (`neuralwatt-client.ts`), so the first keyed run
// supplies the pipeline's own means per bucket, which replace these.
//
// THE MATRIX UNDER-READS THIS PIPELINE'S PROMPTS, and the margin is the answer
// to that. The means come from production traffic whose prompts were largely
// served from the prefix cache, a share the matrix prints per bucket.
// DeepSeek V4.1 Flash, by bucket from 0 to 256 tokens up: 0.000, 0.458, 0.623,
// 0.696, 0.889, 0.976 and 0.982 (256k to 1M); GLM-5.3-Flash: 0.005, 0.138,
// 0.308, 0.362, 0.872, 0.964 and 0.974. This pipeline's prompts are mostly
// fresh (a sheet is built for one question), so the energy of a call is
// expected above the bucket's mean.
//
// THE MARGIN IS 2, a start and not a measurement. Were a bucket's energy
// wholly the work on fresh prompt tokens, a mean over a cached share h would
// understate a fresh prompt by 1/(1-h). By bucket from 256 tokens up that
// bound reads, for DeepSeek V4.1 Flash, 1.84, 2.65, 3.29, 9.0, 42 and 55, and
// for GLM-5.3-Flash 1.16, 1.45, 1.57, 7.8, 27 and 38. It is an upper bound:
// decode work, which these reasoning models spend heavily on, does not scale
// with fresh tokens, and the true multiplier lies between 1 and the bound.
// 2 is the smallest whole number at or above the bound for the lightest
// bucket that has a cached share (1.84), and sits near the middle of the range
// for the sheet-sized buckets of 1k to 16k tokens (1 to 3.3). It is NOT
// claimed to cover the heavier buckets, and no larger figure is justified by
// anything measured: the first run's settled figures say how far off it is.
//
// WHY NOT LARGER. The margin only sizes the hold a call has while in flight,
// because the measured figure replaces it at settlement. What it can strand at
// the end of a day is less than one call's hold, which at these means and a
// margin of 2 is between 0.0004 and 0.33 percent of the 550 Wh by bucket
// (`doc/decision/translation-repair-neuralwatt-provider.md` has the table); a
// larger margin raises that and blocks large prompts earlier in the day. What
// it cannot do is stop plan spend by itself, and it does not need to: a
// request that comes back billed ends the UTC day for this provider at once
// (`neuralwatt-client.ts`), so an under-estimate costs at most the calls in
// flight when the first billed one lands.

/**
 Date the matrix was read, the age of every figure below.
 */
export const NEURALWATT_ENERGY_MATRIX_DATE = '2026-10-20';

/**
 Factor every bucket mean is multiplied by to give the energy a call holds
 while it is in flight; see the module note for why 2.
 */
export const NEURALWATT_ENERGY_MARGIN = 2;

/**
 One bucket of the matrix: the prompt sizes it covers and what a request in it
 used on average, by served model.

 @example
 ```ts
 const bucket: EnergyBucket = { belowTokens: 256, meanWh: { 'deepseek-v4.1-flash': 0.0011364, 'glm-5.3-flash': 0.0030471, }, };
 ```
 */
type EnergyBucket = {
  /**
   Prompt tokens below which a request falls in this bucket (and not in an
   earlier one): the matrix's `max_prompt_tokens`. A prompt at an edge
   belongs to the bucket above it, as the matrix's `min_prompt_tokens` reads.
   */
  readonly belowTokens: number;

  /**
   The matrix's mean watt-hours per request, by served model.
   */
  readonly meanWh: Readonly<Record<NeuralWattServedId, number>>;
};

/**
 The matrix's first seven buckets, in order. Its eighth, a million prompt
 tokens and more, has no figure; a prompt past the last edge is estimated at
 the last bucket's mean.
 */
const ENERGY_BUCKETS: readonly EnergyBucket[] = [
  {
    belowTokens: 256,
    meanWh: {
      'deepseek-v4.1-flash': 0.0011364,
      'glm-5.3-flash': 0.0030471,
    },
  },
  {
    belowTokens: 1_024,
    meanWh: {
      'deepseek-v4.1-flash': 0.0073264,
      'glm-5.3-flash': 0.0088908,
    },
  },
  {
    belowTokens: 4_096,
    meanWh: {
      'deepseek-v4.1-flash': 0.0233012,
      'glm-5.3-flash': 0.0389276,
    },
  },
  {
    belowTokens: 16_384,
    meanWh: {
      'deepseek-v4.1-flash': 0.06962,
      'glm-5.3-flash': 0.1014855,
    },
  },
  {
    belowTokens: 65_536,
    meanWh: {
      'deepseek-v4.1-flash': 0.1394705,
      'glm-5.3-flash': 0.2008592,
    },
  },
  {
    belowTokens: 262_144,
    meanWh: {
      'deepseek-v4.1-flash': 0.2784429,
      'glm-5.3-flash': 0.3999211,
    },
  },
  {
    belowTokens: 1_048_576,
    meanWh: {
      'deepseek-v4.1-flash': 0.6078422,
      'glm-5.3-flash': 0.9089305,
    },
  },
];

/**
 Energy one call is expected to use, and the bucket reading it came from.

 @example
 ```ts
 const estimate: NeuralWattEstimate = { bucketMeanWh: 0.0233012, estimateWh: 0.0466024, };
 ```
 */
export type NeuralWattEstimate = {
  /**
   The matrix's mean for the prompt's bucket, in watt-hours.
   */
  readonly bucketMeanWh: number;

  /**
   What the call holds while in flight: the mean times the margin.
   */
  readonly estimateWh: number;
};

/**
 The least any call can hold: the cheapest bucket of the cheapest model, with
 the margin. A day with less than this left cannot take any call, which is
 where the meter reads dry.
 */
export const NEURALWATT_SMALLEST_ESTIMATE_WH: number = Math.min(
  ...ENERGY_BUCKETS.flatMap(function firstBucketMeans(
    bucket,
    index,
  ): readonly number[] {
    return (index === 0) ? Object.values(bucket.meanWh,) : [];
  },),
) * NEURALWATT_ENERGY_MARGIN;

/**
 Prompt tokens a request body stands for, read off its bytes.

 THE REPOSITORY'S ONE FIGURE, `PROMPT_BYTES_PER_TOKEN` of the abandoned-spend
 estimate: no tokenizer runs before a call, the body is mostly UTF-8 Chinese
 at three bytes a character and English sheet text at one, and the first run
 supplies the real counts (`usage.prompt_tokens`) to compare against.

 @param bodyBytes - size of the JSON body about to be sent

 @returns Prompt tokens, rounded up so a body never reads as lighter than it is

 @example
 ```ts
 promptTokensOfBody({ bodyBytes: 4_001, },); // 1001
 ```
 */
export function promptTokensOfBody({ bodyBytes, }: { readonly bodyBytes: number; },): number {
  return Math.ceil(bodyBytes / PROMPT_BYTES_PER_TOKEN,);
}

/**
 Energy a call is expected to use, by the model and the prompt's size.

 @param servedId - model the call goes to

 @param promptTokens - prompt tokens the call carries

 @returns The bucket's mean and the estimate held against the day

 @throws {@link RangeError} when the count is negative or not a finite number

 @example
 ```ts
 const { estimateWh, } = estimateNeuralWattWh({ servedId: 'glm-5.3-flash', promptTokens: 2_000, },);
 ```
 */
export function estimateNeuralWattWh(
  {
    servedId,
    promptTokens,
  }: {
    readonly servedId: NeuralWattServedId;
    readonly promptTokens: number;
  },
): NeuralWattEstimate {
  if ((!Number.isFinite(promptTokens,)) || (promptTokens < 0))
    throw new RangeError(`a prompt of ${String(promptTokens,)} tokens falls in no energy bucket`,);

  /**
   Bucket the prompt falls in: the first whose edge is above it, else the last
   one measured.
   */
  const bucket = ENERGY_BUCKETS.find(function above(candidate,): boolean {
    return promptTokens < candidate.belowTokens;
  },) ?? nonNullishOrThrow(ENERGY_BUCKETS.at(-1,),);

  /**
   The bucket's mean for this model.
   */
  const bucketMeanWh = bucket.meanWh[servedId];
  return {
    bucketMeanWh,
    estimateWh: bucketMeanWh * NEURALWATT_ENERGY_MARGIN,
  };
}

//endregion NeuralWatt energy estimate
