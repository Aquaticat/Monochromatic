import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type { NeuralWattServedId, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
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
//
// THE 4,096 TO 16,384 TOKEN BUCKET IS THE PIPELINE'S OWN, measured over the
// settled calls of run `zheermao19` (build `5b5dca49a9`, 2026-10-20), where
// nearly every call falls (140 of 143 DeepSeek V4.1 Flash calls, 48 of 54
// GLM-5.3-Flash calls): 10.613 Wh over the 140 and 17.882 Wh over the 48, means
// of 0.0758 and 0.3725 Wh against the matrix's 0.0696 and 0.1015. The matrix
// was near for DeepSeek and read GLM at about a quarter of its use. Its means
// come from production traffic whose prompts were largely served from the
// prefix cache, and this pipeline's sheets are fresh. The other buckets keep
// the matrix's figures: the run held two to four calls in each, too few for a
// mean. Every settled call prints its measured figure beside its estimate
// (`neuralwatt-settlement.ts`), so a later run can replace them the same way.
//
// THE SPREAD IS IN THE OUTPUT, NOT THE PROMPT. The largest single calls were
// 0.840 Wh for DeepSeek, eleven times its mean, and 1.626 Wh for GLM, 4.4
// times its mean. A call's energy tracked its completion tokens (read off the
// `SPEND` line of the same stamp, which 193 of the 197 calls have): the
// correlation was 0.87 for both models, about 0.057 Wh per thousand completion
// tokens for DeepSeek and 0.100 for GLM. These reasoning models spend most of a
// call on decoding, which a prompt-size bucket cannot see before the call is
// sent; the completion cap (`completion-cap.ts` in the shared contract) bounds
// the worst call, and GLM's three calls at 18,316 completion tokens measured
// 1.312 to 1.626 Wh.
//
// THE MARGIN IS 1, now that the bucket that matters holds the measured mean.
// It only sizes the hold a call has while in flight, because the measured
// figure replaces it at settlement, so a hold at the mean is right on average.
// What a short hold can cost is bounded by the calls in flight at the moment
// the day runs out: in that run up to 30 calls settled within one minute, and
// 30 GLM calls each 1.25 Wh past the mean would overrun the day by about 37 Wh
// (6.8 percent of the 550 Wh), a bound no measured minute came near. The old
// margin of 2 was a start and not a measurement; at that run's figures it held
// DeepSeek at 1.8 times its use, and a larger margin sends the last calls of
// every day to a paid provider while the free energy still covers them. What
// the margin cannot do is stop plan spend by itself: a cost a stream reports
// is nominal on free-energy requests too, so it ends nothing
// (`neuralwatt-settlement.ts`), and an overrun shows in the plan-energy
// difference a run prints at its end (`neuralwatt-quota-session.ts`). The
// owner, 2026-10-20: "From here on just use NeuralWatt normally, I can tolerate
// some potential losses. If it works wrongly I'll tell you."

/**
 Factor every bucket mean is multiplied by to give the energy a call holds
 while it is in flight; see the module note for why 1.
 */
export const NEURALWATT_ENERGY_MARGIN = 1;

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
   Mean watt-hours per request, by served model: the matrix's, or the
   pipeline's own where a run measured enough calls in the bucket.
   */
  readonly meanWh: Readonly<Record<NeuralWattServedId, number>>;
};

/**
 The matrix's first seven buckets, in order, one of them holding the measured
 means (the module note says which). Its eighth, a million prompt
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
    // MEASURED, NOT THE MATRIX'S: the pipeline's own means over run
    // `zheermao19` (the module note has the counts and the matrix figures).
    meanWh: {
      'deepseek-v4.1-flash': 0.0758,
      'glm-5.3-flash': 0.3725,
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
 const estimate: NeuralWattEstimate = { bucketMeanWh: 0.0233012, estimateWh: 0.0233012, };
 ```
 */
export type NeuralWattEstimate = {
  /**
   The table's mean for the prompt's bucket, in watt-hours.
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
    throw new RangeError(`a prompt of ${String(promptTokens,)} ${
      wordForCount({
        count: promptTokens,
        one: 'token',
        many: 'tokens',
      },)
    } falls in no energy bucket`,);

  /**
   Bucket the prompt falls in: the first whose edge is above it, else the last
   one measured.
   */
  const bucket = ENERGY_BUCKETS.find(function edgeExceedsPrompt(candidate,): boolean {
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
