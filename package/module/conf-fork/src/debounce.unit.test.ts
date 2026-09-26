/**
 Trailing-edge debounce tests for the change-coalescing wrapper the watcher
 schedules its reloads through.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { debounce, } from '../dist/final/neutral/index.mjs';

/**
 Quiet period under test,
 short enough to keep the suite fast while leaving event-loop lag far below
 the margins the assertions rely on.
 */
const WAIT_MS = 25;

/**
 Settle window used for negative assertions:
 any run this long after a cancel would mean the debounce fired when it
 must not.
 */
const SETTLE_MS = 75;

/**
 Wraps one debounced call whose runs are counted and timestamped.
 
 @returns Recorder whose `debounced` member is the call under test and
 whose counters the assertions read.
 
 @example
 ```ts
 const recorder = createRunRecorder();
 recorder.debounced.trigger();
 ```
 */
function createRunRecorder(): {
  readonly debounced: ReturnType<typeof debounce>;
  readonly runCount: () => number;
  readonly lastRunAt: () => number;
} {
  /**
   Number of completed runs so far.
   */
  let runCount = 0;
  /**
   Timestamp of the most recent run in milliseconds.
   */
  let lastRunAt = 0;
  return {
    debounced: debounce({
      fn: function recordRun(): void {
        runCount += 1;
        lastRunAt = Date.now();
      },
      wait: WAIT_MS,
    },),
    runCount: function readRunCount(): number {
      return runCount;
    },
    lastRunAt: function readLastRunAt(): number {
      return lastRunAt;
    },
  };
}

await describe({
  name: debounce.name,
  children: [
    it({
      name: 'runs the wrapped call once no earlier than the quiet period after a single trigger',
      fn: async () => {
        /**
         Recorder watching the single trigger's run.
         */
        const recorder = createRunRecorder();
        /**
         Timestamp taken immediately before the trigger.
         */
        const triggeredAt = Date.now();
        recorder.debounced.trigger();

        expect(recorder.runCount(),).toBe(0,);

        await wait(SETTLE_MS,);

        expect(recorder.runCount(),).toBe(1,);
        expect(recorder.lastRunAt() - triggeredAt >= WAIT_MS,).toBe(true,);
      },
    },),

    it({
      name: 'collapses rapid triggers into one run after the final trigger',
      fn: async () => {
        /**
         Recorder watching the rapid triggers.
         */
        const recorder = createRunRecorder();
        recorder.debounced.trigger();
        await wait(WAIT_MS / 2,);
        /**
         Timestamp of the final trigger,
         which must restart the quiet period.
         */
        const lastTriggerAt = Date.now();
        recorder.debounced.trigger();

        await wait(SETTLE_MS,);

        expect(recorder.runCount(),).toBe(1,);
        expect(recorder.lastRunAt() - lastTriggerAt >= WAIT_MS,).toBe(true,);
      },
    },),

    it({
      name: 'never runs the wrapped call after a cancel',
      fn: async () => {
        /**
         Recorder whose pending run gets cancelled below.
         */
        const recorder = createRunRecorder();
        recorder.debounced.trigger();
        recorder.debounced.cancel();

        await wait(SETTLE_MS,);

        expect(recorder.runCount(),).toBe(0,);
      },
    },),

    it({
      name: 'treats a cancel with nothing pending as a no-op',
      fn: async () => {
        /**
         Recorder cancelled while nothing is scheduled.
         */
        const recorder = createRunRecorder();
        recorder.debounced.cancel();
        recorder.debounced.cancel();

        await wait(SETTLE_MS,);

        expect(recorder.runCount(),).toBe(0,);
      },
    },),

    it({
      name: 'schedules a fresh run when triggered after a cancel',
      fn: async () => {
        /**
         Recorder whose first schedule is cancelled before a retrigger.
         */
        const recorder = createRunRecorder();
        recorder.debounced.trigger();
        recorder.debounced.cancel();
        recorder.debounced.trigger();

        await wait(SETTLE_MS,);

        expect(recorder.runCount(),).toBe(1,);
      },
    },),
  ],
},);
