/**
 * Tests the budget reading that waits out a refusal hold before calling every
 * provider dry.
 *
 * THE CASE IS THE PIN PASS OF 2026-09-02 (#474): two 429 holds, both meters
 * wet, and every remaining entry failed inside one second because the holds
 * were read as empty meters. Here the reading waits out the shortest hold and
 * reads again, and ends the run only when nothing a wait could change is left.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BudgetView,
  EveryProviderDryError,
  HOLD_POLL_MS,
  NOBODY_REFUSED,
  type ProviderBudgets,
  type ProviderRecord,
  readBudgetsPastHolds,
  shortestHold,
  waitOutHold,
} from '../dist/final/node/index.mjs';

/**
 * Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 * Model named in the log line.
 */
const MODEL_ID = 'hf:moonshotai/Kimi-K3';

/**
 * Builds a budget view that reads a scripted sequence of views and reports
 * fixed holds.
 *
 * @param views - what successive reads return, the last repeating
 *
 * @param holds - what the holds report
 *
 * @returns Budget view plus counts of reads and hold asks
 *
 * @example
 * ```ts
 * const { budgets, reads, } = scriptedBudgets({ views: [ALL_DRY, SYNTHETIC_BACK,], holds: { synthetic: 5, hyper: 20, openrouter: 0, }, },);
 * ```
 */
function scriptedBudgets(
  {
    views,
    holds,
  }: {
    readonly views: readonly BudgetView[];
    readonly holds: ProviderRecord<number>;
  },
): {
  readonly budgets: ProviderBudgets;
  readonly reads: { count: number; };
  readonly holdAsks: { count: number; };
} {
  /**
   * How many reads happened.
   */
  const reads = { count: 0, };
  /**
   * How many times the holds were asked for.
   */
  const holdAsks = { count: 0, };
  return {
    reads,
    holdAsks,
    budgets: {
      read: async function read(): Promise<BudgetView> {
        /**
         * Scripted view for this read, the last one repeating.
         */
        const view = views[Math.min(
          reads.count,
          views.length - 1,
        )];
        reads.count += 1;
        if (view === undefined)
          throw new Error('scripted budgets need at least one view',);
        return view;
      },
      markRefused: async function markRefused(): Promise<void> {
        throw new Error('not asked here',);
      },
      holds: function holdsNow(): ProviderRecord<number> {
        holdAsks.count += 1;
        return { ...holds, };
      },
    },
  };
}

/**
 * Every provider reading dry.
 */
const ALL_DRY: BudgetView = {
  synthetic: true,
  hyper: true,
  openrouter: true,
};

/**
 * The first provider back, the others still dry.
 */
const SYNTHETIC_BACK: BudgetView = {
  synthetic: false,
  hyper: true,
  openrouter: true,
};

/**
 * Nobody held.
 */
const NO_HOLDS: ProviderRecord<number> = {
  synthetic: 0,
  hyper: 0,
  openrouter: 0,
};

await describe({
  name: shortestHold.name,
  children: [
    it({
      name: 'NAMES the first hold to end and reports zero when nobody is held',
      fn: async () => {
        expect(shortestHold({
          holds: {
            synthetic: 0,
            hyper: 4_000,
            openrouter: 0,
          },
        },),).toBe(4_000,);
        expect(shortestHold({
          holds: {
            synthetic: 300,
            hyper: 4_000,
            openrouter: 900,
          },
        },),).toBe(300,);
        expect(shortestHold({ holds: NO_HOLDS, },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: waitOutHold.name,
  children: [
    it({
      name: 'SLEEPS the hold out in poll-sized steps and ENDS WITH THE ABORT REASON when the call is '
        + 'aborted, before a step and after the last one alike',
      fn: async () => {
        /**
         * Wall clock around a short wait.
         */
        const before = Date.now();
        await waitOutHold({
          ms: 6,
          signal: SIGNAL,
          pollMs: 2,
        },);
        expect(Date.now() - before,).toBeGreaterThanOrEqual(5,);

        /**
         * Abort already fired.
         */
        const aborted = new AbortController();
        aborted.abort(new Error('caller gave up',),);
        /**
         * What the wait threw.
         */
        let thrown: unknown;
        try {
          await waitOutHold({
            ms: 50,
            signal: aborted.signal,
            pollMs: 1,
          },);
        } catch (error) {
          thrown = error;
        }
        expect((thrown as Error).message,).toBe('caller gave up',);
        expect(HOLD_POLL_MS,).toBeGreaterThan(0,);
      },
    },),
  ],
},);

await describe({
  name: readBudgetsPastHolds.name,
  children: [
    it({
      name: 'RETURNS THE READING with the routing refusal folded in when at least one provider is '
        + 'spendable, asking for no holds',
      fn: async () => {
        const { budgets, reads, holdAsks, } = scriptedBudgets({
          views: [{
            synthetic: false,
            hyper: false,
            openrouter: false,
          },],
          holds: NO_HOLDS,
        },);
        expect(await readBudgetsPastHolds({
          budgets,
          modelId: MODEL_ID,
          signal: SIGNAL,
          refused: 'synthetic',
          pollMs: 1,
        },),).toEqual({
          synthetic: true,
          hyper: false,
          openrouter: false,
        },);
        expect(reads.count,).toBe(1,);
        expect(holdAsks.count,).toBe(0,);
      },
    },),

    it({
      name: 'WAITS OUT THE SHORTEST HOLD when every provider reads dry and a refusal holds one, then '
        + 'returns the second reading',
      fn: async () => {
        const { budgets, reads, holdAsks, } = scriptedBudgets({
          views: [ALL_DRY, SYNTHETIC_BACK,],
          holds: {
            synthetic: 5,
            hyper: 20,
            openrouter: 0,
          },
        },);
        expect(await readBudgetsPastHolds({
          budgets,
          modelId: MODEL_ID,
          signal: SIGNAL,
          refused: NOBODY_REFUSED,
          pollMs: 1,
        },),).toEqual(SYNTHETIC_BACK,);
        expect(reads.count,).toBe(2,);
        expect(holdAsks.count,).toBe(1,);
      },
    },),

    it({
      name: 'DOES NOT FOLD THE ROUTING REFUSAL INTO THE SECOND READING: the refuser held out is '
        + 'the one whose hold was waited out, so with the other providers dry by meter the call '
        + 'goes back to the refuser rather than ending the run after the wait',
      fn: async () => {
        /**
         * The refuser wet by meter, the others dry by meter, on both reads;
         * the first read folds the refusal in and sees every provider dry.
         */
        const { budgets, reads, holdAsks, } = scriptedBudgets({
          views: [{
            synthetic: false,
            hyper: true,
            openrouter: true,
          },],
          holds: {
            synthetic: 5,
            hyper: 0,
            openrouter: 0,
          },
        },);
        expect(await readBudgetsPastHolds({
          budgets,
          modelId: MODEL_ID,
          signal: SIGNAL,
          refused: 'synthetic',
          pollMs: 1,
        },),).toEqual({
          synthetic: false,
          hyper: true,
          openrouter: true,
        },);
        expect(reads.count,).toBe(2,);
        expect(holdAsks.count,).toBe(1,);
      },
    },),

    it({
      name: 'ENDS THE RUN when every provider reads dry with no hold to wait out, and when they still '
        + 'read dry after the shortest hold ended, waiting at most once',
      fn: async () => {
        /**
         * Both cases, run side by side since neither touches the other.
         */
        const outcomes = await Promise.all(([
          [NO_HOLDS, 1,],
          [{
            synthetic: 5,
            hyper: 20,
            openrouter: 0,
          }, 2,],
        ] as const).map(async function endsTheRun([holds, expectedReads,],): Promise<{
          readonly thrown: unknown;
          readonly reads: number;
          readonly expectedReads: number;
        }> {
          const { budgets, reads, } = scriptedBudgets({
            views: [ALL_DRY,],
            holds,
          },);
          try {
            await readBudgetsPastHolds({
              budgets,
              modelId: MODEL_ID,
              signal: SIGNAL,
              refused: NOBODY_REFUSED,
              pollMs: 1,
            },);
          } catch (error) {
            return {
              thrown: error,
              reads: reads.count,
              expectedReads,
            };
          }
          return {
            thrown: undefined,
            reads: reads.count,
            expectedReads,
          };
        },),);
        for (const outcome of outcomes) {
          expect(outcome.thrown instanceof EveryProviderDryError,).toBe(true,);
          expect(outcome.reads,).toBe(outcome.expectedReads,);
          // The message states what was measured, so a reader can tell
          // exhaustion from refusal holds (#474, option 3).
          expect((outcome.thrown as Error).message,)
            .toContain('meters read synthetic dry, hyper dry, openrouter dry; holds synthetic',);
        }
        /**
         * The waited case names the wait it made.
         */
        const [, waited,] = outcomes;
        if (waited === undefined)
          throw new Error('the waited case did not run',);
        expect((waited.thrown as Error).message,).toContain('after waiting 5ms',);
      },
    },),
  ],
},);
