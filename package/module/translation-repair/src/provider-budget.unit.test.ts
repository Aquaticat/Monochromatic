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
      name: 'holds a provider that refused us out past its own meter',
      fn: async () => {
        /** Stub providers whose meters both report budget left. */
        const { synthetic, hyper, } = stubProviders({},);
        /** Clock the cooldown is judged against. */
        let clock = 1_000;
        /** Budget view under test, on an injected clock. */
        const budgets = createProviderBudgets({
          synthetic,
          hyper,
          cooldownMs: 300,
          now: () => clock,
        },);

        budgets.markRefused({ provider: 'hyper', },);

        // The meter says spendable and the refusal outranks it, because a
        // meter can lag a 429 by its own refresh interval and clearing on it
        // walks straight back into the same wall.
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: true,
        },);

        clock += 300;
        expect(await budgets.read({ signal: SIGNAL, },),).toEqual({
          syntheticDry: false,
          hyperDry: false,
        },);
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

        budgets.markRefused({ provider: 'hyper', },);
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
  ],
},);
