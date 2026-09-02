/**
 * Tests for the cached budget view: what it reads, what it caches, what a
 * refused call corrects, and what it does when a meter cannot be read at all.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createProviderBudgets, } from '../dist/final/node/index.mjs';

/**
 * Quota snapshot of a provider with budget left.
 */
const WET_QUOTA = {
  fiveHour: {
    limited: false,
    remaining: 400,
    max: 500,
    nextTickAt: '2026-08-24T10:00:00.000Z',
  },
  weekly: {
    percentRemaining: 62,
    nextRegenAt: '2026-08-24T13:24:00.000Z',
  },
};

/**
 * Quota snapshot of a provider whose weekly credit ran out, which is the
 * state `#199` was opened on.
 */
const DRY_QUOTA = {
  ...WET_QUOTA,
  weekly: {
    percentRemaining: 0,
    nextRegenAt: '2026-08-24T13:24:00.000Z',
  },
};

/**
 * Builds a pair of stub meters that answer as told.
 *
 * @param quota - what the first provider's quota endpoint returns
 *
 * @param balance - what the second provider's balance endpoint returns
 *
 * @param quotaThrows - whether the first provider's meter is unreachable
 *
 * @returns Both meters plus the count of reads each took
 *
 * @example
 * ```ts
 * const { synthetic, hyper, reads, } = stubProviders({ quota: WET_QUOTA, balance: 243, },);
 * ```
 */
function stubProviders(
  {
    quota = WET_QUOTA,
    balance = 243,
    quotaThrows = false,
  }: {
    readonly quota?: typeof WET_QUOTA;
    readonly balance?: number;
    readonly quotaThrows?: boolean;
  },
) {
  /**
   * How many times each meter was read.
   */
  const reads = {
    quota: 0,
    credits: 0,
  };

  return {
    reads,
    synthetic: {
      quotas: async function quotas() {
        reads.quota += 1;
        if (quotaThrows)
          throw new Error('meter unreachable',);
        return quota;
      },
    },
    hyper: {
      credits: async function credits() {
        reads.credits += 1;
        return { balance, };
      },
    },
  };
}

/**
 * Abort signal every read in these tests carries.
 */
const SIGNAL = new AbortController().signal;

await describe({
  name: createProviderBudgets.name,
  children: [
    it({
      name: 'reads both meters and reports a spendable pair',
      fn: async () => {
        /** Stub providers with budget on both sides. */
        const { synthetic, hyper, reads, } = stubProviders({},);
        /** Budget view under test. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
        },);

        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: false,
        },);
        expect(reads,).toEqual({ quota: 1, credits: 1, },);
      },
    },),

    it({
      name: 'TREATS EACH UNCONFIGURED PROVIDER AS DRY while other remains wet',
      fn: async () => {
        /** Stub providers with budget on both sides. */
        const { synthetic, hyper, } = stubProviders({},);
        const syntheticOnly = createProviderBudgets({ synthetic, },);
        const hyperOnly = createProviderBudgets({ hyper, },);

        expect(await syntheticOnly.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: true,
        },);
        expect(await hyperOnly.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: true,
          hyperDry: false,
        },);
      },
    },),

    it({
      name: 'reads an exhausted weekly credit as dry',
      fn: async () => {
        /** Stub providers with the first one's weekly credit spent. */
        const { synthetic, hyper, } = stubProviders({ quota: DRY_QUOTA, },);
        /** Budget view under test. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
        },);

        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: true,
          hyperDry: false,
        },);
      },
    },),

    it({
      name: 'reads a spent balance as dry',
      fn: async () => {
        /** Stub providers with the second one's balance at nothing. */
        const { synthetic, hyper, } = stubProviders({ balance: 0, },);
        /** Budget view under test. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
        },);

        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: true,
        },);
      },
    },),

    it({
      name: 'ACCEPTS an unreadable meter as spendable rather than exhausted',
      fn: async () => {
        /** Stub providers with the first one's meter unreachable. */
        const { synthetic, hyper, } = stubProviders({ quotaThrows: true, },);
        /** Budget view under test. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
        },);

        // THE DECISION THIS FILE TURNS ON. A meter that times out is a
        // monitoring failure; reading it as exhaustion converts it into an
        // outage, stopping calls that would have succeeded. Being wrong this
        // way costs one refused call, which the router recovers from.
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: false,
        },);
      },
    },),

    it({
      name: 'spends one meter read per window rather than one per call',
      fn: async () => {
        /** Stub providers with budget on both sides. */
        const { synthetic, hyper, reads, } = stubProviders({},);
        /** Clock the cache is judged against. */
        let clock = 1_000;
        /** Budget view under test, on an injected clock. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
          freshForMs: 500,
          now: () => clock,
        },);

        await budgets.read({ signal: SIGNAL, },);
        await budgets.read({ signal: SIGNAL, },);
        expect(reads.quota,).toBe(1,);

        clock += 500;
        await budgets.read({ signal: SIGNAL, },);
        expect(reads.quota,).toBe(2,);
      },
    },),

    it({
      name: 'HOLDS A PROVIDER THAT REFUSED US WHILE ITS METER READS WET for the rate-limit backoff, '
        + 'not the exhaustion cooldown, re-reading the meter at once: a 429 from a wet provider is '
        + 'its concurrency limit, and the five-minute hold on it is what ended the pin pass of '
        + '2026-09-02 (#474)',
      fn: async () => {
        /** Stub providers whose meters both report budget left. */
        const { synthetic, hyper, reads, } = stubProviders({},);
        /** Clock the holds are judged against. */
        let clock = 1_000;
        /** Budget view under test, on an injected clock. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
          cooldownMs: 10_000,
          rateLimitBackoffMs: 300,
          now: () => clock,
        },);

        await budgets.read({ signal: SIGNAL, },);
        await budgets.markRefused({
          provider: 'hyper',
          signal: SIGNAL,
        },);
        // The refusal forced a second read inside the freshness window.
        expect(reads.credits,).toBe(2,);
        expect(budgets.holds(),).toEqual({
          synthetic: 0,
          hyper: 300,
        },);

        // Held out for the backoff even though the meter says spendable.
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: true,
        },);

        clock += 300;
        expect(budgets.holds(),).toEqual({
          synthetic: 0,
          hyper: 0,
        },);
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: false,
        },);
      },
    },),

    it({
      name: 'HOLDS A PROVIDER OUT FOR THE WHOLE COOLDOWN when its meter cannot be read on the refusal, '
        + 'since a refusal is stickier than a reading that never came',
      fn: async () => {
        /** Stub providers whose first meter is unreachable. */
        const { synthetic, hyper, } = stubProviders({ quotaThrows: true, },);
        /** Clock the holds are judged against. */
        let clock = 1_000;
        /** Budget view under test, on an injected clock. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
          cooldownMs: 300,
          rateLimitBackoffMs: 50,
          now: () => clock,
        },);

        await budgets.markRefused({
          provider: 'synthetic',
          signal: SIGNAL,
        },);
        expect(budgets.holds().synthetic,).toBe(300,);

        clock += 50;
        // Past the backoff, still inside the cooldown.
        expect((await budgets.read({ signal: SIGNAL, },)).syntheticDry,).toBe(true,);

        clock += 250;
        // The cooldown ended and an unreadable meter counts as spendable.
        expect((await budgets.read({ signal: SIGNAL, },)).syntheticDry,).toBe(false,);
      },
    },),

    it({
      name: 'never lets a cooldown expiring bring a spent provider back',
      fn: async () => {
        /** Stub providers with the second one's balance at nothing. */
        const { synthetic, hyper, } = stubProviders({ balance: 0, },);
        /** Clock the cooldown is judged against. */
        let clock = 1_000;
        /** Budget view under test, on an injected clock. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
          cooldownMs: 300,
          now: () => clock,
        },);

        await budgets.markRefused({
          provider: 'hyper',
          signal: SIGNAL,
        },);
        // A dry meter agrees with the refusal, so the hold is the cooldown.
        expect(budgets.holds().hyper,).toBe(300,);
        clock += 1_000;

        // The cooldown is one-directional: it can only hold a provider out.
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: true,
        },);
      },
    },),

    it({
      name: 'COALESCES concurrent reads into ONE reading of each meter. The '
        + 'first shape checked staleness before the await and stamped after '
        + 'it, so every call arriving mid-read started its own: a live '
        + 'calibration spent 158 quota reads in 46.5 minutes against a '
        + '60-second window that allows about 46',
      fn: async () => {
        /** How many times each meter was read. */
        const reads = {
          quota: 0,
          credits: 0,
        };

        /** Meters slow enough that concurrent callers genuinely overlap. */
        const slow = {
          synthetic: {
            quotas: async function quotas() {
              reads.quota += 1;
              await wait(20,);
              return WET_QUOTA;
            },
          },
          hyper: {
            credits: async function credits() {
              reads.credits += 1;
              await wait(20,);
              return { balance: 243, };
            },
          },
        };

        /** Budget layer over the slow meters. */
        const budgets = createProviderBudgets({
          synthetic: slow.synthetic,
          hyper: slow.hyper,
        },);

        /** Five calls launched before any of them can finish. */
        const views = await Promise.all([
          budgets.read({ signal: SIGNAL, },),
          budgets.read({ signal: SIGNAL, },),
          budgets.read({ signal: SIGNAL, },),
          budgets.read({ signal: SIGNAL, },),
          budgets.read({ signal: SIGNAL, },),
        ],);

        expect(reads,).toEqual({
          quota: 1,
          credits: 1,
        },);

        // Every sharer must get the reading, not just the caller that started it.
        for (const view of views) {
          expect(view,).toEqual({
            syntheticDry: false,
            hyperDry: false,
          },);
        }
      },
    },),

    it({
      name: 'SHARES ONE FORCED READING among refusals arriving while it is in flight: the pin pass '
        + 'of 2026-09-02 saw eight 429s inside one second, and each forcing its own meter call '
        + 'would spend the reading budget the freshness window exists to protect',
      fn: async () => {
        /** How many times each meter was read. */
        const reads = {
          quota: 0,
          credits: 0,
        };

        /** Meters slow enough that concurrent refusals genuinely overlap. */
        const slow = {
          synthetic: {
            quotas: async function quotas() {
              reads.quota += 1;
              await wait(20,);
              return WET_QUOTA;
            },
          },
          hyper: {
            credits: async function credits() {
              reads.credits += 1;
              await wait(20,);
              return { balance: 243, };
            },
          },
        };

        /** Budget layer over the slow meters, on a clock that does not move. */
        const budgets = createProviderBudgets({
          synthetic: slow.synthetic,
          hyper: slow.hyper,
          rateLimitBackoffMs: 50,
          now: () => 1_000,
        },);

        await budgets.read({ signal: SIGNAL, },);
        /** Three refusals landing before the reading the first one forced can finish. */
        await Promise.all([
          budgets.markRefused({
            provider: 'hyper',
            signal: SIGNAL,
          },),
          budgets.markRefused({
            provider: 'hyper',
            signal: SIGNAL,
          },),
          budgets.markRefused({
            provider: 'synthetic',
            signal: SIGNAL,
          },),
        ],);

        // The first read plus ONE forced by the burst, not one per refusal.
        expect(reads,).toEqual({
          quota: 2,
          credits: 2,
        },);
        expect(budgets.holds(),).toEqual({
          synthetic: 50,
          hyper: 50,
        },);
      },
    },),
  ],
},);
