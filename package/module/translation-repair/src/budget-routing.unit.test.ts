/**
 * Tests for the provider decision.
 *
 * THESE CASES ARE THE OWNER'S POLICY, stated as a table. Synthetic first until
 * its per-model concurrency limit is taken, then overflow to Hyper, which has
 * no such limit; either of Synthetic's two limits emptying is a reason to fail
 * over; both providers empty at once ends the run.
 *
 * THE ASYMMETRY IS DELIBERATE and worth reading twice: a model that only one
 * provider serves loses its voice when that provider is dry, and the run
 * continues. Only both budgets being empty throws, because only then is nothing
 * buyable at all.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BothProvidersDryError,
  hyperIsDry,
  routeProviderFor,
  syntheticIsDry,
} from '../dist/final/node/index.mjs';

/**
 * Budget reading with room left on both of Synthetic's limits.
 */
const roomyQuota = {
  fiveHour: {
    remaining: 750,
    max: 750,
    limited: false,
    nextTickAt: '2026-08-24T22:55:29.000Z',
  },
  weekly: {
    percentRemaining: 99.8,
    nextRegenAt: '2026-08-25T00:12:58.000Z',
  },
} as const;

/**
 * Both providers reachable, which is true of the three shared models.
 */
const bothReach = {
  onSynthetic: true,
  onHyper: true,
} as const;

await describe({
  name: syntheticIsDry.name,
  children: [
    it({
      name: 'READS a roomy budget as not dry',
      fn: async () => {
        expect(syntheticIsDry({ quota: roomyQuota, },),).toBe(false,);
      },
    },),

    it({
      name: 'READS AN EMPTY WEEKLY BUDGET AS DRY, which is the limit that actually emptied and '
        + 'cost 866 of 875 lost voices one HTTP 429 each',
      fn: async () => {
        expect(syntheticIsDry({
          quota: {
            ...roomyQuota,
            weekly: {
              ...roomyQuota.weekly,
              percentRemaining: 0,
            },
          },
        },),).toBe(true,);
      },
    },),

    it({
      name: 'READS an empty five-hour window as dry, since the owner corrected that this provider '
        + 'has two limits and either one stops a call',
      fn: async () => {
        expect(syntheticIsDry({
          quota: {
            ...roomyQuota,
            fiveHour: {
              ...roomyQuota.fiveHour,
              remaining: 0,
            },
          },
        },),).toBe(true,);
      },
    },),

    it({
      name: 'READS the provider saying it is throttling as dry, even with credit left, because '
        + 'that is the provider stating the answer directly',
      fn: async () => {
        expect(syntheticIsDry({
          quota: {
            ...roomyQuota,
            fiveHour: {
              ...roomyQuota.fiveHour,
              limited: true,
            },
          },
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: hyperIsDry.name,
  children: [
    it({
      name: 'READS the measured balance as not dry',
      fn: async () => {
        expect(hyperIsDry({ credits: { balance: 249, }, },),).toBe(false,);
      },
    },),

    it({
      name: 'READS a spent-out balance as dry, at zero and below it',
      fn: async () => {
        expect(hyperIsDry({ credits: { balance: 0, }, },),).toBe(true,);
        expect(hyperIsDry({ credits: { balance: -1, }, },),).toBe(true,);
      },
    },),

    it({
      name: 'READS any positive balance as not dry, since what one call costs was never measured '
        + 'and a cushion would be a number nobody established',
      fn: async () => {
        expect(hyperIsDry({ credits: { balance: 0.01, }, },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: routeProviderFor.name,
  children: [
    it({
      name: 'SENDS TO SYNTHETIC FIRST while its per-model limit has room, which is the owner '
        + 'policy for maximum speed',
      fn: async () => {
        expect(routeProviderFor({
          reach: bothReach,
          syntheticDry: false,
          hyperDry: false,
          syntheticSaturated: false,
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'OVERFLOWS TO HYPER once that limit is taken, because this provider has no per-model '
        + 'concurrency limit and waiting would cost the speed the split is for',
      fn: async () => {
        expect(routeProviderFor({
          reach: bothReach,
          syntheticDry: false,
          hyperDry: false,
          syntheticSaturated: true,
        },),).toEqual({ kind: 'hyper', },);
      },
    },),

    it({
      name: 'FAILS OVER TO HYPER when Synthetic is dry, whether or not its concurrency had room, '
        + 'since budget outranks saturation',
      fn: async () => {
        for (const syntheticSaturated of [true, false,]) {
          expect(routeProviderFor({
            reach: bothReach,
            syntheticDry: true,
            hyperDry: false,
            syntheticSaturated,
          },),).toEqual({ kind: 'hyper', },);
        }
      },
    },),

    it({
      name: 'KEEPS SENDING TO SYNTHETIC PAST SATURATION when Hyper is dry, because a queue behind '
        + 'the per-model limit is slower than the split and still buys the answer',
      fn: async () => {
        expect(routeProviderFor({
          reach: bothReach,
          syntheticDry: false,
          hyperDry: true,
          syntheticSaturated: true,
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'THROWS when both budgets are empty at once, which ends the run at the owner instruction',
      fn: async () => {
        expect(() => {
          routeProviderFor({
            reach: bothReach,
            syntheticDry: true,
            hyperDry: true,
            syntheticSaturated: false,
          },);
        },).toThrow(BothProvidersDryError,);
      },
    },),

    it({
      name: 'THROWS on both budgets empty even for a model neither provider serves, since the '
        + 'run is over either way and the budget is the larger fact',
      fn: async () => {
        expect(() => {
          routeProviderFor({
            reach: {
              onSynthetic: false,
              onHyper: false,
            },
            syntheticDry: true,
            hyperDry: true,
            syntheticSaturated: false,
          },);
        },).toThrow(BothProvidersDryError,);
      },
    },),

    it({
      name: 'KEEPS a Synthetic-only model on Synthetic past saturation, since half the roster has '
        + 'no counterpart on the other provider to overflow to',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            onSynthetic: true,
            onHyper: false,
          },
          syntheticDry: false,
          hyperDry: false,
          syntheticSaturated: true,
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'SENDS a Hyper-only model to Hyper regardless of what Synthetic is doing',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            onSynthetic: false,
            onHyper: true,
          },
          syntheticDry: false,
          hyperDry: false,
          syntheticSaturated: false,
        },),).toEqual({ kind: 'hyper', },);
      },
    },),

    it({
      name: 'REPORTS a one-provider model as unreachable rather than throwing when that provider '
        + 'is dry, because that costs one panelist its voice and the run goes on',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            onSynthetic: true,
            onHyper: false,
          },
          syntheticDry: true,
          hyperDry: false,
          syntheticSaturated: false,
        },).kind,).toBe('unreachable',);
      },
    },),

    it({
      name: 'SEPARATES a model no provider serves from one whose providers are merely dry, since '
        + 'the first is a roster mistake and the second is a budget state',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            onSynthetic: false,
            onHyper: false,
          },
          syntheticDry: false,
          hyperDry: false,
          syntheticSaturated: false,
        },),).toEqual({
          kind: 'unreachable',
          reason: 'no provider serves this model',
        },);

        expect(routeProviderFor({
          reach: {
            onSynthetic: true,
            onHyper: false,
          },
          syntheticDry: true,
          hyperDry: false,
          syntheticSaturated: false,
        },),).toEqual({
          kind: 'unreachable',
          reason: 'every provider serving this model is out of budget',
        },);
      },
    },),
  ],
},);
