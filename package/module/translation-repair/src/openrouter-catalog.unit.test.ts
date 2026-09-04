/**
 * Tests for the OpenRouter catalog: every row stands in for a roster seat,
 * every roster seat has a row, and the routing preferences carry the owner's
 * zero-data-retention decision.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  OPENROUTER_MODELS,
  OPENROUTER_PROVIDER_PREFERENCES,
  openRouterIdFor,
  openRouterProviderPreferencesFor,
  openRouterServesLabel,
  reachOf,
  ROSTER_MODEL_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'OPENROUTER_MODELS',
  children: [
    it({
      name: 'SERVES EVERY ROSTER SEAT AND NOTHING ELSE: nine rows, each standing in for a distinct '
        + 'roster id, so the third provider widens reach without widening the roster',
      fn: async () => {
        /**
         * Roster seats the rows stand in for.
         */
        const seats = Object
          .values(OPENROUTER_MODELS,)
          .map(function seatOf(info,): string {
            return info.sharedWith;
          },);
        expect(seats.toSorted(),).toEqual([...ROSTER_MODEL_IDS,].toSorted(),);
        expect(new Set(seats,).size,).toBe(ROSTER_MODEL_IDS.length,);
      },
    },),

    it({
      name: 'REACHES every roster model, so a day with Synthetic and Hyper both dry still seats the '
        + 'whole roster',
      fn: async () => {
        for (const modelId of ROSTER_MODEL_IDS)
          expect(reachOf({ modelId, },).openrouter,).toBe(true,);
      },
    },),

    it({
      name: 'CARRIES zero data retention and require_parameters on every request, the owner\'s decision '
        + 'of 2026-09-03',
      fn: async () => {
        expect(OPENROUTER_PROVIDER_PREFERENCES,).toEqual({
          zdr: true,
          require_parameters: true,
        },);
      },
    },),

    it({
      name: 'IGNORES the measured endpoints and no others: Parasail and ModelRun for MiniMax M3, '
        + 'OpenInference, Parasail and Reka for DeepSeek V4 Flash, Reka and Io Net for Qwen3.8-27B, Reka '
        + 'for GLM-5.3 (2026-09-03 and 2026-09-04 measurements beside each row), while every other row '
        + 'ignores no endpoint',
      fn: async () => {
        expect(OPENROUTER_MODELS['minimax/minimax-m3'].ignoredEndpoints,).toEqual([
          'parasail',
          'modelrun',
        ],);
        expect(OPENROUTER_MODELS['deepseek/deepseek-v4-flash-0731'].ignoredEndpoints,).toEqual([
          'open-inference',
          'parasail',
          'reka',
        ],);
        expect(OPENROUTER_MODELS['qwen/qwen3.8-27b'].ignoredEndpoints,).toEqual([
          'reka',
          'io-net',
        ],);
        expect(OPENROUTER_MODELS['z-ai/glm-5.3'].ignoredEndpoints,).toEqual(['reka',],);
        /**
         * Rows with a measured endpoint on them.
         */
        const measured: ReadonlySet<string> = new Set([
          'minimax/minimax-m3',
          'deepseek/deepseek-v4-flash-0731',
          'qwen/qwen3.8-27b',
          'z-ai/glm-5.3',
        ],);
        /**
         * Rows other than the two with a measured endpoint.
         */
        const others = Object
          .values(OPENROUTER_MODELS,)
          .filter(function unmeasured(info,): boolean {
            return !measured.has(info.id,);
          },);
        for (const info of others)
          expect(info.ignoredEndpoints,).toEqual([],);
      },
    },),

    it({
      name: 'SPELLS EVERY IGNORED SLUG AS THE GATEWAY LISTS IT, since a slug the gateway does not '
        + 'know is ignored silently: `openinference` kept OpenInference on the wire for a day because '
        + 'the listing spells it `open-inference`',
      fn: async () => {
        /**
         * Provider slugs from `GET https://openrouter.ai/api/v1/providers`, read
         * 2026-09-04 (`~/temp/agent/providers-20260904.json`), for every
         * upstream a run log of that day named for a roster model. Extend it
         * from the same listing when a new slug is ignored.
         */
        const listed: ReadonlySet<string> = new Set([
          'akashml',
          'coreweave',
          'deepinfra',
          'io-net',
          'ionstream',
          'makora',
          'modal',
          'modelrun',
          'open-inference',
          'parasail',
          'phala',
          'reka',
          'together',
          'venice',
        ],);
        for (const info of Object.values(OPENROUTER_MODELS,)) {
          for (const slug of info.ignoredEndpoints)
            expect(listed.has(slug,),).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: openRouterProviderPreferencesFor.name,
  children: [
    it({
      name: 'ADDS the row\'s ignore list to the shared preferences, as a copy the caller may not '
        + 'write back into the catalog',
      fn: async () => {
        /**
         * Preferences for the one row with an ignored endpoint.
         */
        const minimax = openRouterProviderPreferencesFor({ servedId: 'minimax/minimax-m3', },);
        expect(minimax,).toEqual({
          zdr: true,
          require_parameters: true,
          ignore: [
            'parasail',
            'modelrun',
          ],
        },);
        expect(minimax.ignore,).not.toBe(OPENROUTER_MODELS['minimax/minimax-m3'].ignoredEndpoints,);
        expect(openRouterProviderPreferencesFor({ servedId: 'openai/gpt-oss-120b', },),).toEqual({
          zdr: true,
          require_parameters: true,
          ignore: [],
        },);
      },
    },),
  ],
},);

await describe({
  name: openRouterIdFor.name,
  children: [
    it({
      name: 'TRANSLATES each spelling the other providers use into this provider\'s slug',
      fn: async () => {
        expect(openRouterIdFor({ modelId: 'hf:moonshotai/Kimi-K3', },),).toEqual({
          served: true,
          id: 'moonshotai/kimi-k3',
        },);
        expect(openRouterIdFor({ modelId: 'minimax-m3', },),).toEqual({
          served: true,
          id: 'minimax/minimax-m3',
        },);
        expect(openRouterIdFor({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),).toEqual({
          served: true,
          id: 'z-ai/glm-5.3-flash',
        },);
      },
    },),
  ],
},);

await describe({
  name: openRouterServesLabel.name,
  children: [
    it({
      name: 'ANSWERS for a slug and not for a roster spelling, since the roster never names a model this way',
      fn: async () => {
        expect(openRouterServesLabel('moonshotai/kimi-k3',),).toBe(true,);
        expect(openRouterServesLabel('hf:moonshotai/Kimi-K3',),).toBe(false,);
        expect(openRouterServesLabel('kimi-k3',),).toBe(false,);
      },
    },),
  ],
},);
