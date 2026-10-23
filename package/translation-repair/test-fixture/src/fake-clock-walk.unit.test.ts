/**
 Tests that the fake clock walk puts every kind of wait on the fake clock, including a wait built on
 `node:timers/promises` (R9 of the re-check of fix round 5).

 The rig faked the global `setTimeout`, `clearTimeout` and `AbortSignal.timeout`, and a caller cut written with
 `import { setTimeout } from 'node:timers/promises'` was on none of them: its named import is bound once, and the
 sinon clock replaces the property of the CommonJS module object only, so the cut never fired and a case that expected
 it to be heard stayed green. The rig now syncs the built-in module's ES exports after it installs the clock and again
 when the walk ends. Each case here is a wait of two minutes that a tick past two minutes ends, so a wait on the real
 clock cannot end in the case's own time.

 Fixtures are cat-themed invention.

 @module
 */

import { setTimeout as sleepFor, } from 'node:timers/promises';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { walkOnFakeClock, } from './fake-clock-walk.test-fixture.ts';

/**
 The wait this file's module was loaded with, which is the real one: no walk has run when the module is evaluated.
 */
const REAL_SLEEP_FOR = sleepFor;

/**
 How long the cat naps in each case, in fake milliseconds.
 */
const NAP_MS = 120_000;

/**
 A tick that ends the nap.
 */
const PAST_NAP_MS = 121_000;

/**
 Walks one nap on the fake clock.

 @param sinon - case's own sandbox
 @param nap - how the walk waits, given the signal that ends it early
 @param ticks - fake milliseconds to advance, one step after another

 @returns Whether the nap ended by itself

 @example
 ```ts
 const ended = await napWalk({ sinon, nap: signal => sleepFor(NAP_MS, undefined, { signal, },), ticks: [PAST_NAP_MS,], },);
 ```
 */
async function napWalk(
  {
    sinon,
    nap,
    ticks,
  }: {
    readonly sinon: Parameters<typeof walkOnFakeClock>[0]['sinon'];
    readonly nap: (signal: AbortSignal,) => Promise<unknown>;
    readonly ticks: readonly number[];
  },
): Promise<boolean> {
  /**
   Ends the nap when the walk is released, so a nap on a clock the rig does not own cannot outlive the case.
   */
  const stop = new AbortController();
  const walk = await walkOnFakeClock({
    sinon,
    walkOnce: async function napOnce(): Promise<void> {
      try {
        await nap(stop.signal,);
      }
      catch (error) {
        // Only the release's own abort is the walk ending early; anything else is the case failing.
        if (!stop.signal.aborted)
          throw error;
      }
    },
    firstCall: Promise.resolve(),
    release: () => stop.abort(),
    ticks,
    cutCount: () => 0,
    waitForEnd: false,
  },);
  return walk.endedByItself;
}

await describe({
  name: walkOnFakeClock.name,
  // One case at a time: each installs a clock, and the built-in module's exports are one object for the whole process.
  concurrency: 1,
  children: [
    it({
      name: 'ENDS A WAIT BUILT ON THE GLOBAL setTimeout AT ITS FIGURE (the control arm of R9)',
      fn: async ctx => {
        expect(await napWalk({
          sinon: ctx.sinon,
          nap: signal => new Promise<void>(function napping(resolve,): void {
            setTimeout(
              resolve,
              NAP_MS,
            );
            signal.addEventListener(
              'abort',
              () => resolve(),
            );
          },),
          ticks: [PAST_NAP_MS,],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'ENDS A WAIT BUILT ON node:timers/promises AT ITS FIGURE (R9): a cut written with that import was on the '
        + 'real clock, so the heard case stayed green however the cut was written',
      fn: async ctx => {
        expect(await napWalk({
          sinon: ctx.sinon,
          nap: signal => sleepFor(
            NAP_MS,
            undefined,
            { signal, },
          ),
          ticks: [PAST_NAP_MS,],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES A node:timers/promises WAIT UNENDED BEFORE ITS FIGURE (R9 control arm): the rig advances that clock '
        + 'and no further, so the walk below ending above is the clock\'s doing and not the release\'s',
      fn: async ctx => {
        expect(await napWalk({
          sinon: ctx.sinon,
          nap: signal => sleepFor(
            NAP_MS,
            undefined,
            { signal, },
          ),
          ticks: [60_000,],
        },),).toBe(false,);
      },
    },),

    it({
      name: 'PUTS node:timers/promises BACK WHEN THE WALK ENDS (R9): a wait in a case that follows is real, not a '
        + 'wait on a clock whose case has finished',
      fn: async () => {
        expect(sleepFor,).toBe(REAL_SLEEP_FOR,);
      },
    },),
  ],
},);
