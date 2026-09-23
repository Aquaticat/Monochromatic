import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  answerCeilingFor,
  COMPLETION_CAP,
  creditsFor,
  HYPER_MODELS,
  hyperIdFor,
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
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
} from '../dist/final/node/index.mjs';

/** New version identity, not an alias for Flash 0731. */
const MODEL: string = SEAT_HYPER_OPENROUTER_UNMEASURED;

await describe({
  name: '',
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
        expect(openrouter).toMatchObject({ maxOutputLength: 384_000, readsImages: true,
          promptUsdPerMillion: 0.3, completionUsdPerMillion: 1.2, ignoredEndpoints: ['deepinfra', 'wafer', 'open-inference', 'dekallm', 'sail-research'],
          preferredEndpoints: ['morph'] });
      },
    }),
    it({
      name: 'retains the pooled cap rather than copying Flash0731 completion distribution',
      fn: async () => {
        const modelId = nonNullishOrThrow(ROSTER_MODEL_IDS.find(id => id === MODEL));
        const hyper = nonNullishOrThrow(Object.values(HYPER_MODELS).find(info => info.id === MODEL));
        expect(COMPLETION_CAP[modelId]).toBe(13_082);
        expect(answerCeilingFor({ modelId: hyper.id })).toBe(26_214);
      },
    }),
    it({
      name: 'uses the verified Hyper credit conversion while keeping unknown models unpriced',
      fn: async () => {
        // Current Hyper docs define one credit as USD 0.05; the live model quote is 0.3/1.2 USD per million.
        expect(ratesFor({ model: MODEL })).toEqual({ input: 6, output: 24, cacheCreate: 0, cacheHit: 0.6 });
        expect(creditsFor({ model: MODEL, promptTokens: 708, completionTokens: 59 }))
          .toEqual({ inputCredits: 0.004248, outputCredits: 0.001416 });
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
