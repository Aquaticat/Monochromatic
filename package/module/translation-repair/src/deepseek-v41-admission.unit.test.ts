import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  answerCeilingFor,
  COMPLETION_CAP,
  HYPER_MODELS,
  hyperIdFor,
  OPENROUTER_MODELS,
  openRouterIdFor,
  reachOf,
  ROSTER_MODEL_IDS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
} from '../dist/final/node/index.mjs';

/** New version identity, not an alias for Flash 0731. */
const MODEL: string = 'deepseek-v4.1-flash';

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
        expect(ROSTER_MODEL_IDS.includes('deepseek-v4-flash-0731')).toBe(true);
      },
    }),
    it({
      name: 'records each providers measured output ceiling and reported image capability',
      fn: async () => {
        const hyper = Object.values(HYPER_MODELS).find(info => info.id === MODEL);
        const openrouter = Object.values(OPENROUTER_MODELS).find(info => info.id === `deepseek/${MODEL}`);
        expect(hyper).toMatchObject({ maxOutputLength: 26_214, readsImages: true });
        expect(openrouter).toMatchObject({ maxOutputLength: 384_000, readsImages: true,
          promptUsdPerMillion: 0.3, completionUsdPerMillion: 1.2, ignoredEndpoints: [] });
      },
    }),
    it({
      name: 'uses the pooled unmeasured cap rather than copying Flash0731 completion distribution',
      fn: async () => {
        const modelId = nonNullishOrThrow(ROSTER_MODEL_IDS.find(id => id === MODEL));
        const hyper = nonNullishOrThrow(Object.values(HYPER_MODELS).find(info => info.id === MODEL));
        expect(COMPLETION_CAP[modelId]).toBe(13_082);
        expect(answerCeilingFor({ modelId: hyper.id })).toBe(26_214);
        expect(COMPLETION_CAP['deepseek-v4-flash-0731']).toBe(16_543);
      },
    }),
    it({
      name: 'does not seat an approved but uncalibrated model through catalog-derived arrays',
      fn: async () => {
        // Role-specific measurements, not provider count or predecessor ratings, release these holds.
        for (const ids of [RUN_ROSTER, RUN_WIDE_SEATS, RUN_TRANSLATORS, RUN_WRITERS, RUN_READER_MODELS])
          expect(ids.some(id => id === MODEL)).toBe(false);
        // An existing measured reader must not disappear merely because it lacks a judge seat.
        expect(RUN_READER_MODELS.includes('google.gemma-4-31b')).toBe(true);
        expect(RUN_ROSTER.includes('google.gemma-4-31b')).toBe(false);
      },
    }),
  ],
});
