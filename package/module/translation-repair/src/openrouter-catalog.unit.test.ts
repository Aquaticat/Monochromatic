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
  OPENROUTER_DROPPED_SEATS,
  OPENROUTER_MODELS,
  OPENROUTER_PROVIDER_PREFERENCES,
  openRouterIdFor,
  openRouterProviderPreferencesFor,
  openRouterServesLabel,
  reachOf,
  BEDROCK_ONLY_ROSTER_IDS,
  ROSTER_MODEL_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'OPENROUTER_MODELS',
  children: [
    it({
      name: 'SERVES EVERY ROSTER SEAT BUT THE BEDROCK-ONLY SIZES AND THE TWO DROPPED ON 2026-09-09: '
        + 'eight rows, each standing in for a distinct roster id, seven widening reach and one, Mercury 2.5, '
        + 'the seat only this provider serves',
      fn: async () => {
        /**
         * Roster seats the rows stand in for.
         */
        const seats = Object
          .values(OPENROUTER_MODELS,)
          .map(function seatOf(info,): string {
            return info.sharedWith;
          },);
        /**
         * Roster ids this provider can stand in for: everything but the two
         * sizes only Bedrock serves and the two seats dropped on evidence.
         */
        const reachable = ROSTER_MODEL_IDS.filter(function stillServed(modelId,): boolean {
          if (OPENROUTER_DROPPED_SEATS.has(modelId,))
            return false;
          return !BEDROCK_ONLY_ROSTER_IDS.some(function isBedrockOnly(id,): boolean {
            return id === modelId;
          },);
        },);
        expect(seats.toSorted(),).toEqual([...reachable,].toSorted(),);
        expect(new Set(seats,).size,).toBe(reachable.length,);
      },
    },),

    it({
      name: 'REACHES every roster model but the two dropped on 2026-09-09: Qwen3.8-27B keeps its '
        + 'Synthetic seat and GLM-5.3 keeps only its dry Hyper one, so a day with Synthetic and Hyper '
        + 'both dry seats the roster less those two',
      fn: async () => {
        // The two Gemma 4 sizes only Bedrock serves are reached there alone.
        for (const modelId of ROSTER_MODEL_IDS) {
          if (BEDROCK_ONLY_ROSTER_IDS.some(function isBedrockOnly(id,): boolean {
            return id === modelId;
          },))
            continue;
          expect(reachOf({ modelId, },).openrouter,).toBe(!OPENROUTER_DROPPED_SEATS.has(modelId,),);
        }
        expect(reachOf({ modelId: 'hf:Qwen/Qwen3.8-27B', },),).toMatchObject({
          synthetic: true,
          openrouter: false,
        },);
        expect(reachOf({ modelId: 'glm-5.3', },),).toMatchObject({
          hyper: true,
          openrouter: false,
        },);
      },
    },),

    it({
      name: 'CARRIES zero data retention and require_parameters on every request, the owner\'s decision '
        + 'of 2026-09-03, and price-sorted routing since 2026-09-09, when the balancer had sent the anchor '
        + 'judge to endpoints at twice the listing price',
      fn: async () => {
        expect(OPENROUTER_PROVIDER_PREFERENCES,).toEqual({
          zdr: true,
          require_parameters: true,
          sort: 'price',
        },);
      },
    },),

    it({
      name: 'IGNORES the measured endpoints and no others: Parasail and ModelRun for MiniMax M3, '
        + 'OpenInference, Parasail and Reka for DeepSeek V4 Flash (2026-09-03 and 2026-09-04 measurements '
        + 'beside each row), while every other row ignores no endpoint; Qwen3.8-27B and GLM-5.3 left the '
        + 'catalog on 2026-09-09',
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
        /**
         * Rows with a measured endpoint on them.
         */
        const measured: ReadonlySet<string> = new Set([
          'minimax/minimax-m3',
          'deepseek/deepseek-v4-flash-0731',
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
          sort: 'price',
          ignore: [
            'parasail',
            'modelrun',
          ],
        },);
        expect(minimax.ignore,).not.toBe(OPENROUTER_MODELS['minimax/minimax-m3'].ignoredEndpoints,);
        expect(openRouterProviderPreferencesFor({ servedId: 'openai/gpt-oss-120b', },),).toEqual({
          zdr: true,
          require_parameters: true,
          sort: 'price',
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
