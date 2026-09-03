/**
 * Tests the sliding-window request pacer.
 *
 * THE CASE IS XIEPT2 ON HYPER ALONE, 2026-09-03: 1,300 to 1,500 request
 * attempts a minute against a limit that let about 700 through, every
 * refusal retried four more times, the run lost. Here the pacer lets a
 * window's worth start at once, makes the next wait for the oldest start to
 * leave the window, keeps takes in arrival order, and lets an abort end a
 * wait.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createRequestPace,
  HYPER_REQUESTS_PER_MINUTE,
  hyperRequestsPerMinute,
  PACE_WINDOW_MS,
} from '../dist/final/node/index.mjs';

/**
 * Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 * Builds a pacer on a scripted clock whose sleeps advance the clock instead of
 * waiting.
 *
 * @param perMinute - starts allowed per window
 *
 * @returns Pacer plus the clock and the sleeps it asked for
 *
 * @example
 * ```ts
 * const { pace, clock, sleeps, } = scriptedPace({ perMinute: 3, },);
 * ```
 */
function scriptedPace(
  { perMinute, }: { readonly perMinute: number; },
): {
  readonly pace: ReturnType<typeof createRequestPace>;
  readonly clock: { now: number; };
  readonly sleeps: number[];
} {
  /**
   * Scripted clock.
   */
  const clock = { now: 1_000_000, };
  /**
   * Sleeps asked for, in order.
   */
  const sleeps: number[] = [];
  return {
    clock,
    sleeps,
    pace: createRequestPace({
      perMinute,
      now: () => clock.now,
      wait: async function wait(ms,): Promise<void> {
        sleeps.push(ms,);
        clock.now += ms;
      },
    },),
  };
}

await describe({
  name: createRequestPace.name,
  children: [
    it({
      name: 'LETS a window\'s worth of requests start at once and MAKES the next wait until the oldest '
        + 'start leaves the window',
      fn: async () => {
        const { pace, clock, sleeps, } = scriptedPace({ perMinute: 3, },);
        await pace.take({ signal: SIGNAL, },);
        clock.now += 10_000;
        await pace.take({ signal: SIGNAL, },);
        await pace.take({ signal: SIGNAL, },);
        expect(sleeps,).toEqual([],);
        expect(pace.inWindow(),).toBe(3,);
        // The fourth waits for the first start (at 1,000,000) to leave the window.
        await pace.take({ signal: SIGNAL, },);
        expect(sleeps,).toEqual([PACE_WINDOW_MS - 10_000,],);
        expect(pace.inWindow(),).toBe(3,);
      },
    },),

    it({
      name: 'KEEPS concurrent takes in arrival order and counts each start once',
      fn: async () => {
        const { pace, sleeps, } = scriptedPace({ perMinute: 2, },);
        /**
         * Order in which takes resolved.
         */
        const order: number[] = [];
        await Promise.all([1, 2, 3, 4,].map(async function taker(index,): Promise<void> {
          await pace.take({ signal: SIGNAL, },);
          order.push(index,);
        },),);
        expect(order,).toEqual([1, 2, 3, 4,],);
        // The third waits a whole window, which empties it; the fourth then
        // finds a free place beside the third and does not wait.
        expect(sleeps,).toEqual([PACE_WINDOW_MS,],);
        expect(pace.inWindow(),).toBe(2,);
      },
    },),

    it({
      name: 'ENDS a wait with the abort reason when the caller gives up, and paces nothing when the '
        + 'rate is not positive',
      fn: async () => {
        /**
         * Scripted clock whose sleep aborts the caller.
         */
        const aborter = new AbortController();
        const pace = createRequestPace({
          perMinute: 1,
          now: () => 5,
          wait: async function wait(): Promise<void> {
            aborter.abort(new Error('caller gave up',),);
          },
        },);
        await pace.take({ signal: aborter.signal, },);
        /**
         * What the second take threw.
         */
        let thrown: unknown;
        try {
          await pace.take({ signal: aborter.signal, },);
        } catch (error) {
          thrown = error;
        }
        expect((thrown as Error).message,).toBe('caller gave up',);

        const unpaced = scriptedPace({ perMinute: 0, },);
        await unpaced.pace.take({ signal: SIGNAL, },);
        await unpaced.pace.take({ signal: SIGNAL, },);
        expect(unpaced.sleeps,).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: hyperRequestsPerMinute.name,
  children: [
    it({
      name: 'READS a positive number from the variable and falls back to the measured default otherwise',
      fn: async () => {
        expect(hyperRequestsPerMinute({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_MINUTE: '300', }, },),).toBe(300,);
        expect(hyperRequestsPerMinute({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_MINUTE: 'lots', }, },),).toBe(HYPER_REQUESTS_PER_MINUTE,);
        expect(hyperRequestsPerMinute({ env: {}, },),).toBe(HYPER_REQUESTS_PER_MINUTE,);
        expect(HYPER_REQUESTS_PER_MINUTE,).toBe(600,);
      },
    },),
  ],
},);
