/**
 Tests the sliding-window request pacer.
 
 THE CASE IS XIEPT2 ON HYPER ALONE, 2026-09-03: 1,000 requests in a rolling
 hour is the account's limit, the pass spent them in minutes, every refusal
 retried four more times, the run lost. Here the pacer lets a window's worth
 start at once, makes the next wait for the oldest start to leave the window,
 keeps takes in arrival order, and lets an abort end a wait.
 
 @module
 */

import { once, } from 'node:events';

import { wait as pause, } from '@monochromatic-dev/module-async-time/ts';
import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createRequestPace,
  HYPER_PACE_WINDOW_MS,
  HYPER_REQUESTS_PER_HOUR,
  hyperRequestsPerHour,
  StatedRefusalError,
} from '../dist/final/node/index.mjs';

/**
 Abort signal that never fires.
 */
const SIGNAL = new AbortController().signal;

/**
 Window length the scripted pacers use.
 */
const WINDOW_MS = 60_000;

/**
 Window length for the pacer on the real clock: short, since a case sleeps
 through it once.
 */
const REAL_WINDOW_MS = 20;

/**
 Builds a pacer on a scripted clock whose sleeps advance the clock instead of
 waiting.
 
 @param perWindow - starts allowed per window
 
 @returns Pacer plus the clock and the sleeps it asked for
 
 @example
 ```ts
 const { pace, clock, sleeps, } = scriptedPace({ perWindow: 3, },);
 ```
 */
function scriptedPace(
  { perWindow, }: { readonly perWindow: number; },
): {
  readonly pace: ReturnType<typeof createRequestPace>;
  readonly clock: { now: number; };
  readonly sleeps: number[];
} {
  /**
   Scripted clock.
   */
  const clock = { now: 1_000_000, };
  /**
   Sleeps asked for, in order.
   */
  const sleeps: number[] = [];
  return {
    clock,
    sleeps,
    pace: createRequestPace({
      perWindow,
      windowMs: WINDOW_MS,
      now: () => clock.now,
      wait: async function wait({ ms, },): Promise<void> {
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
      name: 'STARTS no concurrent take before one that arrived earlier, and counts each start once',
      fn: async () => {
        const { pace, clock, sleeps, } = scriptedPace({ perWindow: 2, },);
        /**
         When each take, by arrival, was let start.
         */
        const startedAt: number[] = [];
        await Promise.all([0, 1, 2, 3,].map(async function taker(index,): Promise<void> {
          await pace.take({ signal: SIGNAL, },);
          startedAt[index] = clock.now;
        },),);
        // Takes that start together may resolve in either order; what the
        // window owes arrival order is that no later arrival starts sooner.
        expect(startedAt.every(function inOrder(at, index,): boolean {
          return (index === 0) || (at >= (startedAt[index - 1] ?? at));
        },),).toBe(true,);
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
         Aborts the caller from inside its own sleep.
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
         What the second take threw.
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
         Scripted clock for the queued pacer.
         */
        const clock = { now: 1_000_000, };
        /**
         Sleeps the queued pacer asked for.
         */
        const sleeps: number[] = [];
        const queued = createRequestPace({
          perWindow: 1,
          windowMs: WINDOW_MS,
          now: () => clock.now,
          wait: async function wait({ ms, },): Promise<void> {
            sleeps.push(ms,);
            gaveUp.abort(new Error('abandoned in the queue',),);
            clock.now += ms;
          },
        },);
        await queued.take({ signal: SIGNAL, },);
        /**
         Outcomes of a live take, which sleeps, and one queued behind it
         that is abandoned during that sleep.
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

    it({
      name: 'SLEEPS ON THE REAL CLOCK WITH THE DEFAULT SLEEPER until the window has room (ledger T8)',
      fn: async () => {
        const pace = createRequestPace({
          perWindow: 1,
          windowMs: REAL_WINDOW_MS,
        },);
        /**
         Real clock before the first take, which the second cannot pass the
         window of however loaded the machine is.
         */
        const startedAt = performance.now();
        await pace.take({ signal: SIGNAL, },);
        await pace.take({ signal: SIGNAL, },);
        // ONE-SIDED, so load cannot fail it: the second place opens only once
        // the first has left the window, a stall only lengthens the wait, and
        // the millisecond allows for timer rounding.
        expect(performance.now() - startedAt,).toBeGreaterThanOrEqual(REAL_WINDOW_MS - 1,);
      },
    },),

    it({
      name: 'ENDS A REAL-CLOCK SLEEP ON ABORT with the abort reason (ledger T8)',
      fn: async () => {
        // A WINDOW NO STALL CAN OUTLAST, so the second take is certainly
        // asleep when the abort lands. On a window of 20 ms a loaded suite
        // run let the window empty first, and the take resolved (2026-09-29).
        const pace = createRequestPace({
          perWindow: 1,
          windowMs: WINDOW_MS,
        },);
        await pace.take({ signal: SIGNAL, },);

        /**
         A caller that gives up while the default sleeper holds it.
         */
        const aborter = new AbortController();
        /**
         Its take, asleep until the window has room.
         */
        const asleep = pace.take({ signal: aborter.signal, },);
        aborter.abort(new Error('the cat left the queue',),);
        await expect(asleep,).rejects.toThrow('the cat left the queue',);
      },
    },),
  ],
},);

await describe({
  name: hyperRequestsPerHour.name,
  children: [
    it({
      name: 'READS a positive number from the variable and takes the account limit when it is unset',
      fn: async () => {
        expect(hyperRequestsPerHour({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR: '300', }, },),).toBe(300,);
        expect(hyperRequestsPerHour({ env: {}, },),).toBe(HYPER_REQUESTS_PER_HOUR,);
        expect(HYPER_REQUESTS_PER_HOUR,).toBe(1_000,);
        expect(HYPER_PACE_WINDOW_MS,).toBe(3_600_000,);
      },
    },),
    it({
      name: 'REFUSES A VALUE THAT IS NOT A POSITIVE NUMBER, as every other dial does (ledger D14): it fell back to '
        + 'the account limit, so a mistyped rate ran the launch at a pace nobody asked for',
      fn: async () => {
        expect(['lots', '0', '-5',].map(function refusalOf(written,): boolean {
          return caught(function readsRate() {
            hyperRequestsPerHour({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR: written, }, },);
          },) instanceof StatedRefusalError;
        },),).toEqual([true, true, true,],);
      },
    },),
    it({
      name: 'TAKES THE ACCOUNT LIMIT for a variable set to blanks, as the grace, cap, spend ceiling and credit '
        + 'overrides do, where it read the blanks as a rate of zero and refused (ledger B73)',
      fn: async () => {
        expect(hyperRequestsPerHour({ env: { TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR: '  ', }, },),)
          .toBe(HYPER_REQUESTS_PER_HOUR,);
      },
    },),
  ],
},);

/**
 How long the release case gives an abandoned take to end before calling it
 stuck behind another take's wait.
 */
const RELEASE_PATIENCE_MS = 200;

/**
 Sleeper that ends only when its caller gives up, standing for a timer far
 past the case's patience.

 @param signal - caller's abort, the only way out; the wait asked for is never
 reached here

 @example
 ```ts
 const pace = createRequestPace({ perWindow: 1, windowMs: WINDOW_MS, wait: untilAborted, },);
 ```
 */
async function untilAborted({ signal, }: { readonly ms: number; readonly signal?: AbortSignal; },): Promise<void> {
  await once(
    signal ?? SIGNAL,
    'abort',
  );
}

/**
 Resolves once the release case's patience has run out.

 @returns Marker saying the take was still waiting

 @example
 ```ts
 const outcome = await Promise.race([Promise.allSettled([take,],), patienceRunsOut(),],);
 ```
 */
async function patienceRunsOut(): Promise<'still waiting'> {
  await pause(RELEASE_PATIENCE_MS,);
  return 'still waiting';
}

await describe({
  name: 'a full window never holds one caller behind another caller\'s wait (class one hundred forty-nine, hulicaijia30)',
  children: [
    it({
      name: 'RELEASES a caller that gives up while another take waits for the window, at once and with its own '
        + 'reason, and leaves the window holding only the start that happened',
      fn: async () => {
        const pace = createRequestPace({
          perWindow: 1,
          windowMs: WINDOW_MS,
          now: () => 0,
          wait: untilAborted,
        },);
        await pace.take({ signal: SIGNAL, },);
        const first = new AbortController();
        const second = new AbortController();
        const firstTake = pace.take({ signal: first.signal, },);
        const secondTake = pace.take({ signal: second.signal, },);
        second.abort(new Error('the second cat left the queue',),);
        /**
         The second take's outcome, or the marker when it was still waiting.
         */
        const outcome = await Promise.race([
          Promise.allSettled([secondTake,],),
          patienceRunsOut(),
        ],);
        expect(Array.isArray(outcome,),).toBe(true,);
        const [secondSettled,] = outcome as PromiseSettledResult<void>[];
        expect(secondSettled?.status,).toBe('rejected',);
        expect(((secondSettled as PromiseRejectedResult).reason as Error).message,).toBe('the second cat left the queue',);

        first.abort(new Error('the first cat left too',),);
        const [firstSettled,] = await Promise.allSettled([firstTake,],);
        expect(firstSettled.status,).toBe('rejected',);
        expect(pace.inWindow(),).toBe(1,);
      },
    },),
    it({
      name: 'SAYS how long a take would wait now: zero while the window has room, until the oldest start '
        + 'leaves it once full',
      fn: async () => {
        const { pace, clock, } = scriptedPace({ perWindow: 1, },);
        expect(pace.waitMs(),).toBe(0,);
        await pace.take({ signal: SIGNAL, },);
        clock.now += 10_000;
        expect(pace.waitMs(),).toBe(WINDOW_MS - 10_000,);
        clock.now += WINDOW_MS;
        expect(pace.waitMs(),).toBe(0,);
      },
    },),
  ],
},);
