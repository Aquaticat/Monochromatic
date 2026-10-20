/**
 Tests the energy estimate the NeuralWatt meter holds against a call before it
 is sent: the prompt-size bucket's mean energy per request, times a margin,
 for a prompt whose token count is read off its body's bytes.

 THE FIGURES ARE THE MATRIX'S OF 2026-10-20 (`generated_at` 2026-10-20, a
 7-day window, `Wh_per_request` mean on the charged basis) from
 `https://portal.neuralwatt.com/api/energy-pricing/matrix`, pinned here so a
 change to the table in the source is a change to this file too.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  estimateNeuralWattWh,
  NEURALWATT_ENERGY_MARGIN,
  NEURALWATT_SMALLEST_ESTIMATE_WH,
  promptTokensOfBody,
} from '../dist/final/node/index.mjs';

/**
 The matrix's bucket means for `deepseek-v4.1-flash`, by prompt-token bucket.
 */
const DEEPSEEK_MEANS = [
  0.0011364,
  0.0073264,
  0.0233012,
  0.06962,
  0.1394705,
  0.2784429,
  0.6078422,
] as const;

/**
 The matrix's bucket means for `glm-5.3-flash`, by prompt-token bucket.
 */
const GLM_MEANS = [
  0.0030471,
  0.0088908,
  0.0389276,
  0.1014855,
  0.2008592,
  0.3999211,
  0.9089305,
] as const;

/**
 A prompt-token count inside each bucket, in bucket order.
 */
const INSIDE = [100, 500, 2_000, 8_000, 30_000, 100_000, 500_000,] as const;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: estimateNeuralWattWh.name,
      children: [
        it({
          name: 'READS THE MATRIX\'S MEAN FOR THE PROMPT\'S BUCKET and holds it against a margin above one, for '
            + 'each bucket of each model',
          fn: async () => {
            expect(NEURALWATT_ENERGY_MARGIN,).toBeGreaterThan(1,);
            INSIDE.forEach(function check(promptTokens, index,): void {
              expect(estimateNeuralWattWh({ servedId: 'deepseek-v4.1-flash', promptTokens, },).bucketMeanWh,).toBeCloseTo(
                DEEPSEEK_MEANS[index] ?? Number.NaN,
                9,
              );
              expect(estimateNeuralWattWh({ servedId: 'glm-5.3-flash', promptTokens, },).bucketMeanWh,).toBeCloseTo(
                GLM_MEANS[index] ?? Number.NaN,
                9,
              );
              expect(estimateNeuralWattWh({ servedId: 'glm-5.3-flash', promptTokens, },).estimateWh,).toBeCloseTo(
                (GLM_MEANS[index] ?? Number.NaN) * NEURALWATT_ENERGY_MARGIN,
                9,
              );
            },);
          },
        },),

        it({
          name: 'PUTS A PROMPT ON THE LOWER BUCKET\'S SIDE OF EACH EDGE WHEN IT IS UNDER IT, and on the upper one '
            + 'AT it, since the matrix\'s buckets are half-open from below',
          fn: async () => {
            /**
             Bucket means at the first four edges: 256, 1,024, 4,096 and 16,384 tokens.
             */
            const edges = [
              [255, 256,],
              [1_023, 1_024,],
              [4_095, 4_096,],
              [16_383, 16_384,],
            ] as const;
            edges.forEach(function check([under, at,], index,): void {
              expect(estimateNeuralWattWh({ servedId: 'deepseek-v4.1-flash', promptTokens: under, },).bucketMeanWh,)
                .toBeCloseTo(DEEPSEEK_MEANS[index] ?? Number.NaN, 9,);
              expect(estimateNeuralWattWh({ servedId: 'deepseek-v4.1-flash', promptTokens: at, },).bucketMeanWh,)
                .toBeCloseTo(DEEPSEEK_MEANS[index + 1] ?? Number.NaN, 9,);
            },);
          },
        },),

        it({
          name: 'READS A PROMPT PAST THE LAST MEASURED BUCKET AT THE LAST BUCKET\'S MEAN, since the matrix has no figure '
            + 'for a million tokens and more and the model\'s context ends there',
          fn: async () => {
            expect(estimateNeuralWattWh({ servedId: 'deepseek-v4.1-flash', promptTokens: 1_048_576, },).bucketMeanWh,)
              .toBeCloseTo(0.6078422, 9,);
            expect(estimateNeuralWattWh({ servedId: 'glm-5.3-flash', promptTokens: 5_000_000, },).bucketMeanWh,)
              .toBeCloseTo(0.9089305, 9,);
          },
        },),

        it({
          name: 'NAMES THE SMALLEST ESTIMATE IT CAN MAKE, the floor under which no call fits and the meter reads dry',
          fn: async () => {
            expect(NEURALWATT_SMALLEST_ESTIMATE_WH,).toBeCloseTo(0.0011364 * NEURALWATT_ENERGY_MARGIN, 9,);
            expect(estimateNeuralWattWh({ servedId: 'deepseek-v4.1-flash', promptTokens: 0, },).estimateWh,)
              .toBe(NEURALWATT_SMALLEST_ESTIMATE_WH,);
          },
        },),

        it({
          name: 'REFUSES A TOKEN COUNT THAT IS NEGATIVE OR NOT A NUMBER, since no bucket holds it',
          fn: async () => {
            for (const promptTokens of [-1, Number.NaN, Number.POSITIVE_INFINITY,]) {
              expect(caught(function estimate(): void {
                estimateNeuralWattWh({ servedId: 'glm-5.3-flash', promptTokens, },);
              },),).toBeInstanceOf(RangeError,);
            }
          },
        },),
      ],
    },),

    describe({
      name: promptTokensOfBody.name,
      children: [
        it({
          name: 'READS A BODY\'S BYTES AS PROMPT TOKENS AT THE REPOSITORY\'S ONE FIGURE OF FOUR BYTES A TOKEN, rounding up',
          fn: async () => {
            expect(promptTokensOfBody({ bodyBytes: 4_000, },),).toBe(1_000,);
            expect(promptTokensOfBody({ bodyBytes: 4_001, },),).toBe(1_001,);
            expect(promptTokensOfBody({ bodyBytes: 0, },),).toBe(0,);
          },
        },),
      ],
    },),
  ],
},);
