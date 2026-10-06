import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  answerCeilingFor,
  creditsFor,
  HYPER_MODELS,
  hyperIdFor,
  MODEL_CARDS,
  OPENROUTER_MODELS,
  openRouterIdFor,
  ratesFor,
  reachOf,
  ROSTER_MODEL_IDS,
  RUN_LATE_JUDGES,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
} from '../dist/final/node/index.mjs';
import {
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
} from './roster-seats.test-fixture.ts';

/** New version identity, not an alias for Flash 0731. */
const MODEL: string = SEAT_HYPER_OPENROUTER_UNMEASURED;

/** Hyper's price of one credit in USD, from its models documentation and FAQ. */
const USD_PER_HYPER_CREDIT = 0.05;

/** This model's live Hyper quote in USD per million tokens, read on `HYPER_PRICE_READ_ON`. */
const QUOTED_USD_PER_MILLION = { input: 0.3, output: 1.2 } as const;

/** Tokens one quoted rate covers. */
const TOKENS_PER_QUOTE = 1_000_000;

await describe({
  name: 'DeepSeek V4.1 roster admission',
  children: [
    it({
      name: 'registers the approved serving paths as exactly one new roster identity',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.filter(id => id === MODEL)).toHaveLength(1);
        const modelId = nonNullishOrThrow(ROSTER_MODEL_IDS.find(id => id === MODEL));
        expect(hyperIdFor({ modelId })).toEqual({ served: true, id: MODEL });
        expect(openRouterIdFor({ modelId })).toEqual({ served: true, id: `deepseek/${MODEL}` });
        expect(reachOf({ modelId })).toEqual({ synthetic: false, hyper: true, openrouter: true, bedrock: false });
        // The predecessor left the roster on 2026-09-16 at the owner's instruction.
        expect((ROSTER_MODEL_IDS as readonly string[]).includes('deepseek-v4-flash-0731')).toBe(false);
      },
    }),
    it({
      name: 'records each providers measured output ceiling and reported image capability',
      fn: async () => {
        const hyper = Object.values(HYPER_MODELS).find(info => info.id === MODEL);
        const openrouter = Object.values(OPENROUTER_MODELS).find(info => info.id === `deepseek/${MODEL}`);
        expect(hyper).toMatchObject({ maxOutputLength: 26_214, readsImages: true });
        // Morph's listed price, the endpoint the seat buys (ledger P13, 2026-09-28), not the catalog's 0.3 and 1.2.
        expect(openrouter).toMatchObject({ maxOutputLength: 384_000, readsImages: true,
          promptUsdPerMillion: 0.12, completionUsdPerMillion: 0.468, ignoredEndpoints: ['deepinfra', 'wafer', 'open-inference', 'dekallm', 'sail-research'],
          preferredEndpoints: ['morph'] });
      },
    }),
    it({
      name: 'carries a cap measured on its own calls, not a pooled placeholder (ledger P10): the card named the '
        + 'pooled 99th as "no completed-call distribution of its own yet" after 67,353 calls of its own',
      fn: async () => {
        const modelId = nonNullishOrThrow(ROSTER_MODEL_IDS.find(id => id === MODEL));
        const hyper = nonNullishOrThrow(Object.values(HYPER_MODELS).find(info => info.id === MODEL));
        // The measurement and its reading are on the card and in `completion-cap.ts`.
        expect(typeof MODEL_CARDS[modelId].completionCap).toBe('number');
        // Under the measured answer bound, so Hyper asks for the model's own ceiling.
        expect(answerCeilingFor({ modelId: hyper.id })).toBe(hyper.maxOutputLength);
      },
    }),
    it({
      name: 'uses the verified Hyper credit conversion while keeping unknown models unpriced',
      fn: async () => {
        const rates = ratesFor({ model: MODEL });
        if (rates === 'unpriced') throw new Error(`${MODEL} has no Hyper price row`);
        expect(rates.input).toBeCloseTo(QUOTED_USD_PER_MILLION.input / USD_PER_HYPER_CREDIT);
        expect(rates.output).toBeCloseTo(QUOTED_USD_PER_MILLION.output / USD_PER_HYPER_CREDIT);
        const tokens = { promptTokens: 708, completionTokens: 59 };
        const credits = creditsFor({ model: MODEL, ...tokens });
        if (credits === 'unpriced') throw new Error(`${MODEL} priced by rate but not by credits`);
        expect(credits.inputCredits).toBeCloseTo((tokens.promptTokens * rates.input) / TOKENS_PER_QUOTE);
        expect(credits.outputCredits).toBeCloseTo((tokens.completionTokens * rates.output) / TOKENS_PER_QUOTE);
        expect(ratesFor({ model: 'unlisted-fixture-model' })).toBe('unpriced');
      },
    }),
    it({
      name: 'seats independently measured judging and writing while retaining the reader hold',
      fn: async () => {
        // The source-reviewed 2026-09-11 comparison measured judging, not writing or image reading;
        // the 40-round producer calibration of 2026-09-19 measured writing (z +0.79 at the pooled null).
        for (const ids of [RUN_ROSTER, RUN_WIDE_SEATS, RUN_LATE_JUDGES, RUN_TRANSLATORS, RUN_WRITERS])
          expect(ids.filter(id => id === MODEL)).toHaveLength(1);
        expect(RUN_READER_MODELS.some(id => id === MODEL)).toBe(false);
        // An existing measured reader must not disappear merely because it lacks a judge seat.
        expect(RUN_READER_MODELS.includes(SEAT_BEDROCK_ONLY_VISION_UNSEATED)).toBe(true);
        expect(RUN_ROSTER.includes(SEAT_BEDROCK_ONLY_VISION_UNSEATED)).toBe(false);
      },
    }),
  ],
});
