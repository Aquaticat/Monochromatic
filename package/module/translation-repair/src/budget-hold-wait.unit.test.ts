/**
 * Tests the budget reading that waits out a refusal hold before calling both
 * providers dry.
 *
 * THE CASE IS THE PIN PASS OF 2026-09-02 (#474): two 429 holds, both meters
 * wet, and every remaining entry failed inside one second because the holds
 * were read as empty meters. Here the reading waits out the shorter hold and
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
  BothProvidersDryError,
  type BudgetView,
  HOLD_POLL_MS,
  type ProviderBudgets,
  type ProviderName,
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
 * const { budgets, reads, } = scriptedBudgets({ views: [BOTH_DRY, SYNTHETIC_BACK,], holds: { synthetic: 5, hyper: 20, }, },);
 * ```
 */
function scriptedBudgets(
  {
    views,
    holds,
  }: {
    readonly views: readonly BudgetView[];
    readonly holds: Record<ProviderName, number>;
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
      holds: function holdsNow(): Record<ProviderName, number> {
        holdAsks.count += 1;
        return { ...holds, };
      },
    },
  };
}

/**
 * Both providers reading dry.
 */
const BOTH_DRY: BudgetView = {
  syntheticDry: true,
  hyperDry: true,
};

/**
 * The first provider back, the second still dry.
 */
const SYNTHETIC_BACK: BudgetView = {
  syntheticDry: false,
  hyperDry: true,
};

/**
 * Nobody held.
 */
const NO_HOLDS: Record<ProviderName, number> = {
  synthetic: 0,
  hyper: 0,
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
          },
        },),).toBe(4_000,);
        expect(shortestHold({
          holds: {
            synthetic: 300,
            hyper: 4_000,
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
            syntheticDry: false,
            hyperDry: false,
          },],
          holds: NO_HOLDS,
        },);
        expect(await readBudgetsPastHolds({
          budgets,
          modelId: MODEL_ID,
          signal: SIGNAL,
          syntheticDown: true,
          pollMs: 1,
        },),).toEqual({
          syntheticDry: true,
          hyperDry: false,
        },);
        expect(reads.count,).toBe(1,);
        expect(holdAsks.count,).toBe(0,);
      },
    },),

    it({
      name: 'WAITS OUT THE SHORTER HOLD when both providers read dry and a refusal holds one, then '
        + 'returns the second reading',
      fn: async () => {
        const { budgets, reads, holdAsks, } = scriptedBudgets({
          views: [BOTH_DRY, SYNTHETIC_BACK,],
          holds: {
            synthetic: 5,
            hyper: 20,
          },
        },);
        expect(await readBudgetsPastHolds({
          budgets,
          modelId: MODEL_ID,
          signal: SIGNAL,
          syntheticDown: false,
          pollMs: 1,
        },),).toEqual(SYNTHETIC_BACK,);
        expect(reads.count,).toBe(2,);
        expect(holdAsks.count,).toBe(1,);
      },
    },),

    it({
      name: 'ENDS THE RUN when both read dry with no hold to wait out, and when they still read dry '
        + 'after the shorter hold ended, waiting at most once',
      fn: async () => {
        /**
         * Both cases, run side by side since neither touches the other.
         */
        const outcomes = await Promise.all(([
          [NO_HOLDS, 1,],
          [{
            synthetic: 5,
            hyper: 20,
          }, 2,],
        ] as const).map(async function endsTheRun([holds, expectedReads,],): Promise<{
          readonly thrown: unknown;
          readonly reads: number;
          readonly expectedReads: number;
        }> {
          const { budgets, reads, } = scriptedBudgets({
            views: [BOTH_DRY,],
            holds,
          },);
          try {
            await readBudgetsPastHolds({
              budgets,
              modelId: MODEL_ID,
              signal: SIGNAL,
              syntheticDown: false,
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
          expect(outcome.thrown instanceof BothProvidersDryError,).toBe(true,);
          expect(outcome.reads,).toBe(outcome.expectedReads,);
        }
      },
    },),
  ],
},);
