/**
 * Tests the sliding-window request pacer.
 *
 * THE CASE IS XIEPT2 ON HYPER ALONE, 2026-09-03: 1,000 requests in a rolling
 * hour is the account's limit, the pass spent them in minutes, every refusal
 * retried four more times, the run lost. Here the pacer lets a window's worth
 * start at once, makes the next wait for the oldest start to leave the window,
 * keeps takes in arrival order, and lets an abort end a wait.
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
  HYPER_PACE_WINDOW_MS,
  HYPER_REQUESTS_PER_HOUR,
  hyperRequestsPerHour,
} from '../dist/final/node/index.mjs';

/**
 * Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 * Window length the scripted pacers use.
 */
const WINDOW_MS = 60_000;

/**
 * Builds a pacer on a scripted clock whose sleeps advance the clock instead of
 * waiting.
 *
 * @param perWindow - starts allowed per window
 *
 * @returns Pacer plus the clock and the sleeps it asked for
 *
 * @example
 * ```ts
 * const { pace, clock, sleeps, } = scriptedPace({ perWindow: 3, },);
 * ```
 */
function scriptedPace(
  { perWindow, }: { readonly perWindow: number; },
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
      perWindow,
      windowMs: WINDOW_MS,
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
        const { pace, clock, sleeps, } = scriptedPace({ perWindow: 3, },);
        await pace.take({ signal: SIGNAL, },);
        clock.now += 10_000;
        await pace.take({ signal: SIGNAL, },);
        await pace.take({ signal: SIGNAL, },);
        expect(sleeps,).toEqual([],);
        expect(pace.inWindow(),).toBe(3,);
        // The fourth waits for the first start (at 1,000,000) to leave the window.
        await pace.take({ signal: SIGNAL, },);
        expect(sleeps,).toEqual([WINDOW_MS - 10_000,],);
        expect(pace.inWindow(),).toBe(3,);
      },
    },),

    it({
      name: 'KEEPS concurrent takes in arrival order and counts each start once',
      fn: async () => {
        const { pace, sleeps, } = scriptedPace({ perWindow: 2, },);
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
        expect(sleeps,).toEqual([WINDOW_MS,],);
        expect(pace.inWindow(),).toBe(2,);
      },
    },),

    it({
      name: 'ENDS a wait with the abort reason when the caller gives up, REFUSES a place to a caller '
        + 'that gave up while queued, and paces nothing when the rate is not positive',
      fn: async () => {
        /**
         * Aborts the caller from inside its own sleep.
         */
        const aborter = new AbortController();
        const pace = createRequestPace({
          perWindow: 1,
          windowMs: WINDOW_MS,
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

        // A caller that aborts while queued behind a sleeping take gets no
        // place when its turn comes: the sleeping take's own wait is where the
        // queued caller gives up, so the abort lands after take() accepted it.
        const gaveUp = new AbortController();
        /**
         * Scripted clock for the queued pacer.
         */
        const clock = { now: 1_000_000, };
        /**
         * Sleeps the queued pacer asked for.
         */
        const sleeps: number[] = [];
        const queued = createRequestPace({
          perWindow: 1,
          windowMs: WINDOW_MS,
          now: () => clock.now,
          wait: async function wait(ms,): Promise<void> {
            sleeps.push(ms,);
            gaveUp.abort(new Error('abandoned in the queue',),);
            clock.now += ms;
          },
        },);
        await queued.take({ signal: SIGNAL, },);
        /**
         * Outcomes of a live take, which sleeps, and one queued behind it
         * that is abandoned during that sleep.
         */
        const outcomes = await Promise.allSettled([
          queued.take({ signal: SIGNAL, },),
          queued.take({ signal: gaveUp.signal, },),
        ],);
        expect(outcomes.map((outcome,) => outcome.status,),).toEqual(['fulfilled', 'rejected',],);
        // Without the check the abandoned caller would sleep a second window
        // and take a place of its own.
        expect(sleeps,).toEqual([WINDOW_MS,],);
        expect(queued.inWindow(),).toBe(1,);

        const unpaced = scriptedPace({ perWindow: 0, },);
        await unpaced.pace.take({ signal: SIGNAL, },);
        await unpaced.pace.take({ signal: SIGNAL, },);
        expect(unpaced.sleeps,).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: hyperRequestsPerHour.name,
  children: [
    it({
      name: 'READS a positive number from the variable and falls back to the account limit otherwise',
      fn: async () => {
        expect(hyperRequestsPerHour({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR: '300', }, },),).toBe(300,);
        expect(hyperRequestsPerHour({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR: 'lots', }, },),).toBe(HYPER_REQUESTS_PER_HOUR,);
        expect(hyperRequestsPerHour({ env: {}, },),).toBe(HYPER_REQUESTS_PER_HOUR,);
        expect(HYPER_REQUESTS_PER_HOUR,).toBe(1_000,);
        expect(HYPER_PACE_WINDOW_MS,).toBe(3_600_000,);
      },
    },),
  ],
},);
