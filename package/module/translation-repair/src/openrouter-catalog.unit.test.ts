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
        + 'of 2026-09-03, with no endpoint ignored on the day of the probe',
      fn: async () => {
        expect(OPENROUTER_PROVIDER_PREFERENCES,).toEqual({
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
