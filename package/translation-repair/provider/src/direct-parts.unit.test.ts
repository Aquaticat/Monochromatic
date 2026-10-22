/**
 Tests for the parts DeepSeek's and Xiaomi's routes are built from: the balance
 parser, the prices, the usage readers, the meters, the model locks and the
 place of both providers in the routing order.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { PROVIDER_ORDER, } from '@monochromatic-dev/translation-repair-shared-contract';
import {
  createProviderBudgets,
  DEEPSEEK_DRY_FLOOR_USD,
  DEEPSEEK_MODELS,
  DeepSeekBalanceShapeError,
  deepSeekCacheSplitOf,
  deepSeekCostOf,
  deepSeekIdFor,
  deepSeekIsDry,
  deepSeekMeterLevel,
  deepSeekShowsPictures,
  DIRECT_COST_UNREPORTED,
  parseDeepSeekBalance,
  readEveryMeter,
  reachOf,
  routeProviderFor,
  systemFingerprintOf,
  XIAOMI_MODELS,
  xiaomiCostOf,
  xiaomiIdFor,
  xiaomiIsDry,
  xiaomiMeterLevel,
  xiaomiShowsPictures,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_OPENROUTER_ONLY_CHECKER,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';

/**
 A balance body as DeepSeek writes it.

 @param fields - members of the USD entry

 @returns Body text

 @example
 ```ts
 const body = balanceBody({ total_balance: '9.96', },);
 ```
 */
function balanceBody({ total, available = true, }: { readonly total: string; readonly available?: boolean; },): string {
  return JSON.stringify({
    is_available: available,
    balance_infos: [{ currency: 'USD', total_balance: total, granted_balance: '0.00', topped_up_balance: total, },],
  },);
}

/**
 Every provider false, for a record the cases then set.
 */
const NONE_DRY = Object.fromEntries(PROVIDER_ORDER.map((provider,) => [provider, false,]),) as Record<
  (typeof PROVIDER_ORDER)[number],
  boolean
>;

/**
 Abort signal every read here carries.
 */
const SIGNAL = new AbortController().signal;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: parseDeepSeekBalance.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS the USD total and availability',
          fn: async () => {
            expect(parseDeepSeekBalance({ bodyText: balanceBody({ total: '9.96', }), },),)
              .toEqual({ isAvailable: true, totalUsd: 9.96, },);
            expect(parseDeepSeekBalance({ bodyText: balanceBody({ total: '0.00', available: false, }), },),)
              .toEqual({ isAvailable: false, totalUsd: 0, },);
          },
        },),
        it({
          name: 'REFUSES every body that is not the documented shape, naming what failed',
          fn: async () => {
            const bad: readonly string[] = [
              'not json',
              '[]',
              '{"is_available":"yes","balance_infos":[]}',
              '{"is_available":true,"balance_infos":"none"}',
              '{"is_available":true,"balance_infos":[]}',
              JSON.stringify({
                is_available: true,
                balance_infos: [
                  { currency: 'USD', total_balance: '1.00', },
                  { currency: 'USD', total_balance: '2.00', },
                ],
              },),
              JSON.stringify({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: 9.96, },], },),
              balanceBody({ total: '-1.00', },),
              balanceBody({ total: 'a lot', },),
              balanceBody({ total: '', },),
            ];
            for (const bodyText of bad)
              expect(function parse(): unknown {
                return parseDeepSeekBalance({ bodyText, },);
              },).toThrow(DeepSeekBalanceShapeError,);
          },
        },),
      ],
    },),

    describe({
      name: 'direct prices and usage readers',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PRICES DeepSeek at peak with the cache split, all misses when the block split nothing, and reports '
            + 'nothing when no usage arrived',
          fn: async () => {
            const card = DEEPSEEK_MODELS['deepseek-flash'];
            const extracted = { text: '', usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, }, };
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
          name: 'PRICES Xiaomi with the cached count, never a negative miss count, and reports nothing without usage',
          fn: async () => {
            const card = XIAOMI_MODELS['mimo-v2.6-flash'];
            const extracted = { text: '', usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, }, };
            expect(xiaomiCostOf({ card, extracted, cachedTokens: 50, },),)
              .toBeCloseTo(((50 * 0.0028) + (50 * 0.14) + (10 * 0.28)) / 1_000_000, 12,);
            expect(xiaomiCostOf({ card, extracted, cachedTokens: 500, },),)
              .toBeCloseTo(((500 * 0.0028) + (10 * 0.28)) / 1_000_000, 12,);
            expect(xiaomiCostOf({ card, extracted: { text: '', }, cachedTokens: 0, },),).toBe(DIRECT_COST_UNREPORTED,);
          },
        },),
        it({
          name: 'READS the last usage block\'s cache split and ignores counts that are not whole numbers',
          fn: async () => {
            const stream = [
              `data: ${JSON.stringify({ choices: [], usage: { prompt_cache_hit_tokens: 1, prompt_cache_miss_tokens: 2, }, },)}\n\n`,
              `data: ${JSON.stringify({ choices: [], usage: { prompt_cache_hit_tokens: 40, prompt_cache_miss_tokens: 60, }, },)}\n\n`,
            ].join('',);
            expect(deepSeekCacheSplitOf({ bodyText: stream, },),).toEqual({ hitTokens: 40, missTokens: 60, },);
            const odd = `data: ${JSON.stringify({
              choices: [],
              usage: { prompt_cache_hit_tokens: -3, prompt_cache_miss_tokens: 1.5, },
            },)}\n\n`;
            expect(deepSeekCacheSplitOf({ bodyText: odd, },),).toEqual({},);
            expect(deepSeekCacheSplitOf({ bodyText: 'data: [DONE]\n\n', },),).toEqual({},);
          },
        },),
        it({
          name: 'READS the last non-empty system_fingerprint, and nothing where no chunk carried one',
          fn: async () => {
            const stream = [
              `data: ${JSON.stringify({ system_fingerprint: 'fp_a', choices: [], },)}\n\n`,
              `data: ${JSON.stringify({ system_fingerprint: '', choices: [], },)}\n\n`,
              `data: ${JSON.stringify({ system_fingerprint: 'fp_b', choices: [], },)}\n\n`,
            ].join('',);
            expect(systemFingerprintOf({ bodyText: stream, },),).toBe('fp_b',);
            expect(systemFingerprintOf({ bodyText: 'data: [DONE]\n\n', },),).toBeUndefined();
          },
        },),
      ],
    },),

    describe({
      name: 'direct meters',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS DeepSeek dry when the account is unavailable or the balance is at or under the floor, wet above it',
          fn: async () => {
            expect(DEEPSEEK_DRY_FLOOR_USD,).toBe(0,);
            expect(deepSeekIsDry({ balance: { isAvailable: false, totalUsd: 50, }, },),).toBe(true,);
            expect(deepSeekIsDry({ balance: { isAvailable: true, totalUsd: 0, }, },),).toBe(true,);
            expect(deepSeekIsDry({ balance: { isAvailable: true, totalUsd: 0.01, }, },),).toBe(false,);
            expect(deepSeekMeterLevel({ balance: { isAvailable: true, totalUsd: 9.96, }, },),)
              .toEqual(['deepseekUsd=9.96',],);
          },
        },),
        it({
          name: 'READS Xiaomi wet always, and reports the run\'s priced spend to four places',
          fn: async () => {
            expect(xiaomiIsDry({ spend: { spentUsd: 1_000, }, },),).toBe(false,);
            expect(xiaomiMeterLevel({ spend: { spentUsd: 0.0042, }, },),).toEqual(['xiaomiUsdSpent=0.0042',],);
          },
        },),
        it({
          name: 'PUTS both in the METERS record: DeepSeek by balance, Xiaomi wet with its spend, and an unset key dry '
            + 'with nothing to report',
          fn: async () => {
            const keyed = await readEveryMeter({
              deepseek: { credits: async () => ({ isAvailable: true, totalUsd: 9.96, }), },
              xiaomi: { spend: async () => ({ spentUsd: 0.0042, }), },
              signal: SIGNAL,
            },);
            expect(keyed.deepseek,).toEqual({ state: 'wet', fields: ['deepseekUsd=9.96',], },);
            expect(keyed.xiaomi,).toEqual({ state: 'wet', fields: ['xiaomiUsdSpent=0.0042',], },);
            const unset = await readEveryMeter({ signal: SIGNAL, },);
            expect(unset.deepseek,).toEqual({ state: 'dry', fields: [], },);
            expect(unset.xiaomi,).toEqual({ state: 'dry', fields: [], },);
            const failing = await readEveryMeter({
              deepseek: {
                credits: async () => {
                  throw new Error('balance offline',);
                },
              },
              signal: SIGNAL,
            },);
            expect(failing.deepseek.state,).toBe('unreadable',);
          },
        },),
        it({
          name: 'HOLDS Xiaomi dry after a payment refusal, which its always-wet meter cannot say, and DeepSeek dry when '
            + 'its balance is empty',
          fn: async () => {
            const budgets = createProviderBudgets({
              deepseek: { credits: async () => ({ isAvailable: true, totalUsd: 0, }), },
              xiaomi: { spend: async () => ({ spentUsd: 0.0042, }), },
            },);
            const first = await budgets.read({ signal: SIGNAL, },);
            expect(first.deepseek,).toBe(true,);
            expect(first.xiaomi,).toBe(false,);
            await budgets.markRefused({ provider: 'xiaomi', signal: SIGNAL, paymentRequired: true, },);
            const second = await budgets.read({ signal: SIGNAL, },);
            expect(second.xiaomi,).toBe(true,);
          },
        },),
      ],
    },),

    describe({
      name: 'direct locks and routing order',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SPELLS only the one model each provider is granted for, and shows pictures for neither of the others',
          fn: async () => {
            expect(deepSeekIdFor({ modelId: SEAT_HYPER_OPENROUTER_UNMEASURED, },),).toEqual({ served: true, id: 'deepseek-flash', },);
            expect(deepSeekIdFor({ modelId: SEAT_OPENROUTER_ONLY_CHECKER, },),).toEqual({ served: false, },);
            expect(xiaomiIdFor({ modelId: SEAT_OPENROUTER_ONLY_CHECKER, },),).toEqual({ served: true, id: 'mimo-v2.6-flash', },);
            expect(xiaomiIdFor({ modelId: SEAT_HYPER_OPENROUTER_UNMEASURED, },),).toEqual({ served: false, },);
            expect(deepSeekShowsPictures({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, },),).toBe(false,);
            expect(xiaomiShowsPictures({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, },),).toBe(false,);
            expect(deepSeekShowsPictures({ modelId: SEAT_HYPER_OPENROUTER_UNMEASURED, },),)
              .toBe(DEEPSEEK_MODELS['deepseek-flash'].readsImages,);
            expect(xiaomiShowsPictures({ modelId: SEAT_OPENROUTER_ONLY_CHECKER, },),)
              .toBe(XIAOMI_MODELS['mimo-v2.6-flash'].readsImages,);
          },
        },),
        it({
          name: 'WALKS the order for deepseek-v4.1-flash: NeuralWatt, then DeepSeek, then Hyper, then OpenRouter',
          fn: async () => {
            const reach = reachOf({ modelId: SEAT_HYPER_OPENROUTER_UNMEASURED, },);
            expect(reach.deepseek,).toBe(true,);
            expect(reach.xiaomi,).toBe(false,);
            /**
             What the router picks given which providers are dry.

             @param dry - providers that read dry

             @returns The choice
             */
            const pick = (dry: readonly (typeof PROVIDER_ORDER)[number][]) => routeProviderFor({
              reach,
              dry: { ...NONE_DRY, ...Object.fromEntries(dry.map((provider,) => [provider, true,]),), },
              saturated: NONE_DRY,
            },);
            expect(pick([],),).toMatchObject({ kind: 'neuralwatt', },);
            expect(pick(['neuralwatt',],),).toMatchObject({ kind: 'deepseek', },);
            expect(pick(['neuralwatt', 'deepseek',],),).toMatchObject({ kind: 'hyper', },);
            expect(pick(['neuralwatt', 'deepseek', 'hyper',],),).toMatchObject({ kind: 'openrouter', },);
          },
        },),
        it({
          name: 'WALKS the order for mimo-v2.6-flash: Xiaomi before OpenRouter, OpenRouter once Xiaomi is dry',
          fn: async () => {
            const reach = reachOf({ modelId: SEAT_OPENROUTER_ONLY_CHECKER, },);
            expect(reach.xiaomi,).toBe(true,);
            expect(reach.deepseek,).toBe(false,);
            expect(reach.openrouter,).toBe(true,);
            expect(routeProviderFor({ reach, dry: NONE_DRY, saturated: NONE_DRY, },),).toMatchObject({ kind: 'xiaomi', },);
            expect(routeProviderFor({ reach, dry: { ...NONE_DRY, xiaomi: true, }, saturated: NONE_DRY, },),)
              .toMatchObject({ kind: 'openrouter', },);
            expect(routeProviderFor({ reach, dry: NONE_DRY, saturated: { ...NONE_DRY, xiaomi: true, }, },),)
              .toMatchObject({ kind: 'openrouter', },);
          },
        },),
      ],
    },),
  ],
},);
