import { setTimeout as realWait, } from 'node:timers/promises';

import type { DisposableSandbox, } from '@monochromatic-dev/module-test/ts';
import { HANG_STOP_MS, } from './hang-stop.test-fixture.ts';

//region Fake clock walk
// RUNS A WALK THAT LASTS MINUTES ON A FAKE CLOCK, for the cases that ask whether a call outlives a deadline without
// waiting for it. `setTimeout` and `clearTimeout` are faked on the calling case's own sandbox, and the signal factory
// `AbortSignal.timeout` is replaced by one built on the fake `setTimeout`, so a signal made from a timer, from
// `AbortSignal.timeout` or from `AbortSignal.any` over either aborts at its figure on the fake clock and the cut
// shows. The clock stands still until the walk has made its first call, since the walk reads its inputs over real I/O
// first and ticking through that would spend the scripted minutes before anything had been asked. The clock is then
// ticked by the steps the case hands, and the case reads how many exchanges the transport had cut after each.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The delayed transport this drives is `delayed-transport.test-fixture.ts` of the
// provider package; this file knows it only through the promise and the release it is handed.

/**
 What the walk did on the fake clock.
 */
export type FakeClockWalk = {
  /**
   Whether the walk had ended on its own when the ticking stopped, so its outcome came from the clock and not from the
   release.
   */
  readonly endedByItself: boolean;

  /**
   How many exchanges the transport had cut after each tick, in the order of the ticks.
   */
  readonly cutsAfterEachTick: readonly number[];
};

/**
 Runs a walk on a fake clock, ticks it by the steps handed, then releases the transport so the walk always ends.

 @param sinon - case's own sandbox, which restores the clock and the signal factory when the case ends

 @param walkOnce - starts the walk and settles when it ends

 @param firstCall - settles when the walk makes its first call

 @param release - ends every exchange still waiting and every later one

 @param ticks - fake milliseconds to advance, one step after another

 @param cutCount - reads how many exchanges the transport has cut so far, called after each tick

 @param waitForEnd - whether to wait, up to the hang stop, for the walk to end once the ticking is done; a case whose
 walk is meant to outlast the ticking passes false and reads `endedByItself` as false

 @returns Whether the walk ended by itself, and the cuts counted after each tick

 @throws Error when the walk makes no call in the real time the case allows

 @throws Whatever the walk threw, once the transport is released

 @example
 ```ts
 const { endedByItself, } = await walkOnFakeClock({
   sinon,
   walkOnce,
   firstCall,
   release,
   ticks: [520_000,],
   cutCount,
   waitForEnd: true,
 },);
 ```
 */
export async function walkOnFakeClock(
  {
    sinon,
    walkOnce,
    firstCall,
    release,
    ticks,
    cutCount,
    waitForEnd,
  }: {
    readonly sinon: DisposableSandbox;
    readonly walkOnce: () => Promise<void>;
    readonly firstCall: Promise<void>;
    readonly release: () => void;
    readonly ticks: readonly number[];
    readonly cutCount: () => number;
    readonly waitForEnd: boolean;
  },
): Promise<FakeClockWalk> {
  /**
   The fake clock.
   */
  const clock = sinon.useFakeTimers({ toFake: [
    'setTimeout',
    'clearTimeout',
  ], },);
  sinon.stub(
    AbortSignal,
    'timeout',
  )
    .callsFake(function timeoutOnFakeClock(ms,): AbortSignal {
    /**
     Controller the fake timer aborts.
     */
      const controller = new AbortController();
      setTimeout(
        function expire(): void {
          controller.abort(new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError',
          ),);
        },
        ms,
      );
      return controller.signal;
    },);

  /**
   Whether the walk has ended, either way, and what it threw, in a list of none or one.
   */
  const ended = {
    done: false,
    thrown: [] as unknown[],
  };

  /**
   Starts the walk and notes how it ends, so a failure of the walk is not left unhandled while the clock ticks.
   */
  async function tracking(): Promise<void> {
    try {
      await walkOnce();
    }
    catch (error) {
      ended.thrown
        .push(error,);
    }
    ended.done = true;
  }

  /**
   The walk's end, whichever way.
   */
  const settled = tracking();

  /**
   Cuts counted after each tick so far.
   */
  const cutsAfterEachTick: number[] = [];

  /**
   Waits for the walk's first call, ticks the clock by the steps, and reports whether the walk ended before the
   release, which is what tells a cut or a reply from the case giving up. The transport is released when this scope
   ends, however it ends.

   @returns Whether the walk ended by itself
   */
  async function ticked(): Promise<boolean> {
    /**
     Releases the transport when the scope ends.
     */
    using _released = { [Symbol.dispose]: release, };
    await Promise.race([
      firstCall,
      settled,
      realWait(HANG_STOP_MS,)
        .then(function giveUp(): never {
          throw new Error('the walk made no call in the real time the case allows',);
        },),
    ],);
    await ticks.reduce<Promise<void>>(
      async function afterTick(
        previous,
        ms,
      ): Promise<void> {
        await previous;
        await clock.tickAsync(ms,);
        cutsAfterEachTick.push(cutCount(),);
      },
      Promise.resolve(),
    );
    if (waitForEnd)
      await Promise.race([
        settled,
        realWait(HANG_STOP_MS,),
      ],);
    return ended.done;
  }

  /**
   Whether the walk ended before the release.
   */
  const endedByItself = await ticked();
  await settled;
  if (ended.thrown
    .length
    > 0)
    throw ended.thrown[0];
  return {
    endedByItself,
    cutsAfterEachTick,
  };
}

//endregion Fake clock walk
