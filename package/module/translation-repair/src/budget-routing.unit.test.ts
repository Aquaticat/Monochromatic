/**
 * Tests for the provider decision.
 *
 * THESE CASES ARE THE OWNER'S POLICY, stated as a table. Synthetic first until
 * its per-model concurrency limit is taken, then overflow to Hyper, which has
 * no such limit; either of Synthetic's two limits emptying is a reason to fail
 * over; Hyper dry too sends the call to OpenRouter (2026-09-03); every
 * provider empty at once ends the run.
 *
 * THE ASYMMETRY IS DELIBERATE and worth reading twice: a model that some
 * providers do not serve loses its voice when the ones that do are dry, and
 * the run continues. Only every budget being empty throws, because only then
 * is nothing buyable at all.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  EveryProviderDryError,
  hyperIsDry,
  hyperMeterLevel,
  NO_PROVIDER,
  providerServing,
  routeProviderFor,
  syntheticIsDry,
  syntheticMeterLevel,
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
 * Every provider reachable, which is true of the shared seats since OpenRouter
 * serves the whole roster.
 */
const everyReach = {
  synthetic: true,
  hyper: true,
  openrouter: true,
} as const;

/**
 * Nobody dry.
 */
const allWet = {
  synthetic: false,
  hyper: false,
  openrouter: false,
} as const;

/**
 * Nobody saturated.
 */
const noneSaturated = allWet;

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
  name: providerServing.name,
  children: [
    it({
      name: 'NAMES the first provider in spending order that serves the model and reads wet, or none',
      fn: async () => {
        expect(providerServing({
          reach: everyReach,
          dry: allWet,
        },),).toBe('synthetic',);
        expect(providerServing({
          reach: everyReach,
          dry: {
            ...allWet,
            synthetic: true,
          },
        },),).toBe('hyper',);
        expect(providerServing({
          reach: everyReach,
          dry: {
            ...allWet,
            synthetic: true,
            hyper: true,
          },
        },),).toBe('openrouter',);
        expect(providerServing({
          reach: {
            ...everyReach,
            synthetic: false,
          },
          dry: allWet,
        },),).toBe('hyper',);
        expect(providerServing({
          reach: everyReach,
          dry: {
            synthetic: true,
            hyper: true,
            openrouter: true,
          },
        },),).toBe(NO_PROVIDER,);
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
          reach: everyReach,
          dry: allWet,
          saturated: noneSaturated,
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'OVERFLOWS TO HYPER once that limit is taken, because this provider has no per-model '
        + 'concurrency limit and waiting would cost the speed the split is for',
      fn: async () => {
        expect(routeProviderFor({
          reach: everyReach,
          dry: allWet,
          saturated: {
            ...noneSaturated,
            synthetic: true,
          },
        },),).toEqual({ kind: 'hyper', },);
      },
    },),

    it({
      name: 'SWITCHES TO HYPER when Synthetic is dry, whether or not its concurrency had room, '
        + 'since budget outranks saturation',
      fn: async () => {
        for (const synthetic of [true, false,]) {
          expect(routeProviderFor({
            reach: everyReach,
            dry: {
              ...allWet,
              synthetic: true,
            },
            saturated: {
              ...noneSaturated,
              synthetic,
            },
          },),).toEqual({ kind: 'hyper', },);
        }
      },
    },),

    it({
      name: 'FALLS THROUGH TO OPENROUTER when Synthetic and Hyper are both dry, the owner\'s order '
        + 'of 2026-09-03: the paid provider is last, and it is where a call goes when the '
        + 'subscription and the balance are both out',
      fn: async () => {
        expect(routeProviderFor({
          reach: everyReach,
          dry: {
            synthetic: true,
            hyper: true,
            openrouter: false,
          },
          saturated: noneSaturated,
        },),).toEqual({ kind: 'openrouter', },);
      },
    },),

    it({
      name: 'KEEPS SENDING TO SYNTHETIC PAST SATURATION when nobody behind it is usable, because a '
        + 'queue behind the per-model limit is slower than the split and still buys the answer',
      fn: async () => {
        expect(routeProviderFor({
          reach: everyReach,
          dry: {
            synthetic: false,
            hyper: true,
            openrouter: true,
          },
          saturated: {
            ...noneSaturated,
            synthetic: true,
          },
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'OVERFLOWS PAST A DRY HYPER TO OPENROUTER when Synthetic is saturated, since the walk '
        + 'prefers the first usable provider with a free slot wherever it sits in the order',
      fn: async () => {
        expect(routeProviderFor({
          reach: everyReach,
          dry: {
            synthetic: false,
            hyper: true,
            openrouter: false,
          },
          saturated: {
            ...noneSaturated,
            synthetic: true,
          },
        },),).toEqual({ kind: 'openrouter', },);
      },
    },),

    it({
      name: 'THROWS when every budget is empty at once, which ends the run at the owner instruction',
      fn: async () => {
        expect(() => {
          routeProviderFor({
            reach: everyReach,
            dry: {
              synthetic: true,
              hyper: true,
              openrouter: true,
            },
            saturated: noneSaturated,
          },);
        },).toThrow(EveryProviderDryError,);
      },
    },),

    it({
      name: 'THROWS on every budget empty even for a model no provider serves, since the '
        + 'run is over either way and the budget is the larger fact',
      fn: async () => {
        expect(() => {
          routeProviderFor({
            reach: {
              synthetic: false,
              hyper: false,
              openrouter: false,
            },
            dry: {
              synthetic: true,
              hyper: true,
              openrouter: true,
            },
            saturated: noneSaturated,
          },);
        },).toThrow(EveryProviderDryError,);
      },
    },),

    it({
      name: 'KEEPS a model with one provider on that provider past saturation, since there is '
        + 'no counterpart elsewhere to overflow to',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            synthetic: true,
            hyper: false,
            openrouter: false,
          },
          dry: allWet,
          saturated: {
            ...noneSaturated,
            synthetic: true,
          },
        },),).toEqual({ kind: 'synthetic', },);
      },
    },),

    it({
      name: 'SENDS a model Synthetic does not serve to Hyper regardless of what Synthetic is doing',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            synthetic: false,
            hyper: true,
            openrouter: true,
          },
          dry: allWet,
          saturated: noneSaturated,
        },),).toEqual({ kind: 'hyper', },);
      },
    },),

    it({
      name: 'REPORTS a model as unreachable rather than throwing when every provider serving it '
        + 'is dry while another is wet, because that costs one panelist its voice and the run goes on',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            synthetic: true,
            hyper: false,
            openrouter: false,
          },
          dry: {
            ...allWet,
            synthetic: true,
          },
          saturated: noneSaturated,
        },).kind,).toBe('unreachable',);
      },
    },),

    it({
      name: 'SEPARATES a model no provider serves from one whose providers are merely dry, since '
        + 'the first is a roster mistake and the second is a budget state',
      fn: async () => {
        expect(routeProviderFor({
          reach: {
            synthetic: false,
            hyper: false,
            openrouter: false,
          },
          dry: allWet,
          saturated: noneSaturated,
        },),).toEqual({
          kind: 'unreachable',
          reason: 'no provider serves this model',
        },);

        expect(routeProviderFor({
          reach: {
            synthetic: true,
            hyper: false,
            openrouter: false,
          },
          dry: {
            ...allWet,
            synthetic: true,
          },
          saturated: noneSaturated,
        },),).toEqual({
          kind: 'unreachable',
          reason: 'every provider serving this model is out of budget',
        },);
      },
    },),
  ],
},);

await describe({
  name: syntheticMeterLevel.name,
  children: [
    it({
      name: 'names both limits, including the one with room left',
      fn: async () => {
        expect(syntheticMeterLevel({ quota: roomyQuota, },),).toEqual([
          'syntheticWeekly=99.8%',
          'syntheticFiveHour=750/750',
          'syntheticThrottled=no',
        ],);
      },
    },),

    it({
      name: 'separates active throttling from an emptied budget, which route the same way',
      fn: async () => {
        /**
         * A reading whose window is full and whose account is being throttled,
         * which `syntheticIsDry` calls dry for a reason the state cannot show.
         */
        const throttled = syntheticMeterLevel({
          quota: {
            ...roomyQuota,
            fiveHour: {
              ...roomyQuota.fiveHour,
              limited: true,
            },
          },
        },);

        expect(syntheticIsDry({
          quota: {
            ...roomyQuota,
            fiveHour: {
              ...roomyQuota.fiveHour,
              limited: true,
            },
          },
        },),).toBe(true,);
        expect(throttled,).toEqual([
          'syntheticWeekly=99.8%',
          'syntheticFiveHour=750/750',
          'syntheticThrottled=yes',
        ],);
      },
    },),
  ],
},);

await describe({
  name: hyperMeterLevel.name,
  children: [
    it({
      name: 'names the one number this provider reports',
      fn: async () => {
        expect(hyperMeterLevel({ credits: { balance: 0, }, },),).toEqual(['hyperBalance=0',],);
      },
    },),
  ],
},);
