/**
 * Tests for the order a run attempts its entries in.
 *
 * `entry-reattempt.ts` decides whether ONE attempt earned another, and its own
 * tests cover that arithmetic. This covers the sequence those verdicts produce,
 * which is a separate thing that can be wrong on its own: a correct verdict
 * driven by a loop that never comes back settles nothing, and a loop that comes
 * back too eagerly spends a three-day budget on one entry.
 *
 * THE ORDERING CASE IS THE ONE THAT WOULD COST MOST IF WRONG. A re-attempt that
 * jumped the queue would let the largest entry in the corpus take attempt after
 * attempt while entries that fit in one were never tried at all, which is worse
 * than the cap this replaced: the cap at least moved on.
 *
 * Every effect is injected, so no case here reads a corpus, calls a provider,
 * or waits on anything.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runAttemptQueue, } from '../../dist/final/node/index.mjs';

/**
 * Scheduler disposition returned by scripted attempt.
 */
type AttemptOutcome =
  | { readonly kind: 'settled'; }
  | { readonly kind: 'resumable-failure'; }
  | { readonly kind: 'stopped'; };

/**
 * What one stub entry does on each successive attempt.
 */
type Script = {
  /**
   * Entry id.
   */
  readonly id: string;

  /**
   * Cached slice count after each attempt, read in order.
   */
  readonly cachedAfter: readonly number[];

  /**
   * Attempt number, one-based, that settles this entry; zero for never.
   */
  readonly settlesOn: number;

  /**
   * Attempt number, one-based, that stops whole-entry retry; zero or absent for never.
   */
  readonly stopsOn?: number;
};

/**
 * Builds a queue harness driving `runAttemptQueue` from a script.
 *
 * @param scripts - what each entry does, in the order they are pending
 *
 * @param stopAfter - attempts to allow before the budget ends the run; zero
 * allows every attempt
 *
 * @returns Order attempts were made in, once the queue has drained
 *
 * @example
 * ```ts
 * const order = await attemptOrder({ scripts, },);
 * ```
 */
async function attemptOrder(
  {
    scripts,
    stopAfter = 0,
  }: {
    readonly scripts: readonly Script[];
    readonly stopAfter?: number;
  },
): Promise<readonly string[]> {
  /**
   * Ids in the order they were attempted.
   */
  const order: string[] = [];

  /**
   * How many times each entry has been attempted so far.
   */
  const tries = new Map<string, number>();

  /**
   * Script for one id.
   */
  function scriptFor({ id, }: { readonly id: string; },): Script {
    /**
     * Matching script, which the cases always provide.
     */
    const found = scripts.find(function byId(script,): boolean {
      return script.id === id;
    },);

    if (found === undefined)
      throw new Error(`no script for ${id}`,);
    return found;
  }

  await runAttemptQueue({
    pending: scripts.map(function toEntry({ id, },): { readonly id: string; } {
      return { id, };
    },),

    cachedCountFor: async function cachedCountFor({ entry, },): Promise<number> {
      /**
       * Attempts made against this entry so far.
       */
      const made = tries.get(entry.id,) ?? 0;

      // Before the first attempt nothing is cached; afterwards the script says.
      if (made === 0)
        return 0;
      return scriptFor({ id: entry.id, },)
        .cachedAfter[made - 1] ?? 0;
    },

    stopBeforeNext: function stopBeforeNext(): boolean {
      if (stopAfter === 0)
        return false;
      return order.length >= stopAfter;
    },

    attempt: async function attempt({ entry, },): Promise<AttemptOutcome> {
      order.push(entry.id,);

      /**
       * Attempt number this is, one-based.
       */
      const made = (tries.get(entry.id,) ?? 0) + 1;
      tries.set(
        entry.id,
        made,
      );
      const script = scriptFor({ id: entry.id, },);
      if (script.settlesOn === made)
        return { kind: 'settled', };
      if (script.stopsOn === made)
        return { kind: 'stopped', };
      return { kind: 'resumable-failure', };
    },
  },);

  return order;
}

await describe({
  name: runAttemptQueue.name,
  children: [
    it({
      name: 'ATTEMPTS EVERY ENTRY ONCE BEFORE ANY RE-ATTEMPT, which is the '
        + 'property that keeps one oversized entry from spending the whole '
        + 'budget while entries that fit in a single attempt are never tried',
      fn: async () => {
        expect(
          await attemptOrder({
            scripts: [
              {
                id: 'aiyysk',
                cachedAfter: [
                  5,
                  5,
                ],
                settlesOn: 0,
              },
              {
                id: 'tabby',
                cachedAfter: [0,],
                settlesOn: 0,
              },
              {
                id: 'whiskers',
                cachedAfter: [3,],
                settlesOn: 1,
              },
            ],
          },),
        ).toEqual([
          'aiyysk',
          'tabby',
          'whiskers',
          'aiyysk',
        ],);
      },
    },),

    it({
      name: 'KEEPS RE-ATTEMPTING while an entry buys slices, so an entry too '
        + 'large for one attempt settles across a sequence of them rather than '
        + 'needing a relaunch that would move the build under its cache',
      fn: async () => {
        expect(
          await attemptOrder({
            scripts: [
              {
                id: 'xingz',
                cachedAfter: [
                  45,
                  64,
                  90,
                ],
                settlesOn: 3,
              },
            ],
          },),
        ).toEqual([
          'xingz',
          'xingz',
          'xingz',
        ],);
      },
    },),

    it({
      name: 'DOES NOT RESTART WHOLE ENTRY after stage-local incomplete result even when cache grew',
      fn: async () => {
        expect(
          await attemptOrder({
            scripts: [{
              id: 'naturalness-rejected',
              cachedAfter: [13,],
              settlesOn: 0,
              stopsOn: 1,
            },],
          },),
        ).toEqual(['naturalness-rejected',],);
      },
    },),

    it({
      name: 'DROPS an entry that bought nothing, which is the stop condition: '
        + 'no progress guarantee holds, so an entry whose attempt cached '
        + 'nothing would otherwise repeat until the budget was gone',
      fn: async () => {
        expect(
          await attemptOrder({
            scripts: [
              {
                id: 'stuck',
                cachedAfter: [0,],
                settlesOn: 0,
              },
            ],
          },),
        ).toEqual(['stuck',],);
      },
    },),

    it({
      name: 'STOPS on the budget without attempting what is left, so a run '
        + 'that has spent its wall time starts nothing new',
      fn: async () => {
        expect(
          await attemptOrder({
            scripts: [
              {
                id: 'first',
                cachedAfter: [5,],
                settlesOn: 1,
              },
              {
                id: 'second',
                cachedAfter: [5,],
                settlesOn: 1,
              },
              {
                id: 'third',
                cachedAfter: [5,],
                settlesOn: 1,
              },
            ],
            stopAfter: 2,
          },),
        ).toEqual([
          'first',
          'second',
        ],);
      },
    },),
  ],
},);
