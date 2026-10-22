/**
 Tests for the pricing of one DeepSeek or Xiaomi call from the usage it reported and the card's rates.

 Rates in the expected figures are the cards' own, in USD per million tokens: DeepSeek at peak 0.006 (hit), 0.3 (miss)
 and 1.2 (output); Xiaomi 0.0028 (cached), 0.14 and 0.28. Fixtures are cat-themed invention.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEEPSEEK_MODELS,
  deepSeekCostOf,
  DIRECT_COST_UNREPORTED,
  XIAOMI_MODELS,
  xiaomiCostOf,
} from '../dist/final/node/index.mjs';

/**
 DeepSeek's card, whose rates price a call.
 */
const DEEPSEEK_CARD = DEEPSEEK_MODELS['deepseek-flash'];

/**
 Xiaomi's card, whose rates price a call.
 */
const XIAOMI_CARD = XIAOMI_MODELS['mimo-v2.6-flash'];

/**
 A completion whose usage block reported 100 prompt and 10 completion tokens.
 */
const HUNDRED_AND_TEN = { text: '', usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, }, };

/**
 A completion whose usage block reported no tokens at all.
 */
const NO_TOKENS = { text: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, }, };

await describe({
  name: 'direct cost',
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    describe({
      name: deepSeekCostOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRICES DeepSeek at peak with the cache split, all misses when the block split nothing, and reports '
            + 'nothing when no usage arrived',
          fn: async () => {
            const card = DEEPSEEK_CARD;
            const extracted = HUNDRED_AND_TEN;
            expect(deepSeekCostOf({ card, extracted, split: { hitTokens: 40, missTokens: 60, }, },),)
              .toBeCloseTo(((40 * 0.006) + (60 * 0.3) + (10 * 1.2)) / 1_000_000, 12,);
            expect(deepSeekCostOf({ card, extracted, split: {}, },),)
              .toBeCloseTo(((100 * 0.3) + (10 * 1.2)) / 1_000_000, 12,);
            expect(deepSeekCostOf({ card, extracted, split: { hitTokens: 40, }, },),)
              .toBeCloseTo(((40 * 0.006) + (60 * 0.3) + (10 * 1.2)) / 1_000_000, 12,);
            expect(deepSeekCostOf({ card, extracted: { text: '', }, split: {}, },),).toBe(DIRECT_COST_UNREPORTED,);
          },
        },),
        it({
          name: 'PRICES a block that names only a miss count as that many misses and no hits, and the output either way',
          fn: async () => {
            expect(deepSeekCostOf({ card: DEEPSEEK_CARD, extracted: HUNDRED_AND_TEN, split: { missTokens: 60, }, },),)
              .toBeCloseTo(((60 * 0.3) + (10 * 1.2)) / 1_000_000, 12,);
          },
        },),
        it({
          name: 'PRICES a zero-token usage block at zero, which is a reported cost and not an unreported one',
          fn: async () => {
            expect(deepSeekCostOf({ card: DEEPSEEK_CARD, extracted: NO_TOKENS, split: {}, },),).toBe(0,);
          },
        },),
      ],
    },),
    describe({
      name: xiaomiCostOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRICES Xiaomi with the cached count and reports nothing without usage',
          fn: async () => {
            const card = XIAOMI_CARD;
            const extracted = HUNDRED_AND_TEN;
            expect(xiaomiCostOf({ card, extracted, cachedTokens: 50, },),)
              .toBeCloseTo(((50 * 0.0028) + (50 * 0.14) + (10 * 0.28)) / 1_000_000, 12,);
            expect(xiaomiCostOf({ card, extracted, cachedTokens: 0, },),)
              .toBeCloseTo(((100 * 0.14) + (10 * 0.28)) / 1_000_000, 12,);
            expect(xiaomiCostOf({ card, extracted: { text: '', }, cachedTokens: 0, },),).toBe(DIRECT_COST_UNREPORTED,);
          },
        },),
        it({
          name: 'PRICES a zero-token usage block at zero, which is a reported cost and not an unreported one',
          fn: async () => {
            expect(xiaomiCostOf({ card: XIAOMI_CARD, extracted: NO_TOKENS, cachedTokens: 0, },),).toBe(0,);
          },
        },),
      ],
    },),
  ],
},);
