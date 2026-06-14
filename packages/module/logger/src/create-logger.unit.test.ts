import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createLogger, } from './create-logger.ts';
import type {
  LogRecord,
  Sink,
  SinkFlush,
  Verify,
} from './types.ts';

/**
 * Milliseconds a slow write parks before recording, long enough that the
 * record is provably still pending when a synchronous assertion runs but the
 * draining `flush()` must wait for it.
 */
const SLOW_WRITE_MS = 25;

/**
 * Recording sink plus the array it appends every written record to, so a test
 * can assert exactly which records crossed the seam.
 */
type RecordingSink = {
  readonly records: LogRecord[];
  readonly sink: Sink;
};

/**
 * Builds a fake sink that records every record it receives. The seam under
 * test is `Sink`, so the whole orchestration (verify, replay, fan-out, flush)
 * is exercised through one self-contained adapter with no globals to reset.
 *
 * @param verify - Backend availability check; defaults to synchronously available.
 *
 * @param flush - Optional flush hook the logger should drain.
 *
 * @param writeDelayMs - Milliseconds each write parks before recording, to
 * keep a record pending across a `flush()`.
 *
 * @returns Sink adapter paired with its recorded-record array.
 */
function recordingSink(
  {
    verify = function verifyAvailable(): Promise<boolean> {
      return Promise.resolve(true,);
    },
    flush,
    writeDelayMs = 0,
  }: {
    readonly flush?: SinkFlush;
    readonly verify?: Verify;
    readonly writeDelayMs?: number;
  } = {},
): RecordingSink {
  /**
   * Records this sink has received, in arrival order.
   */
  const records: LogRecord[] = [];

  /**
   * Records every received record after the optional delay.
   *
   * @param record - Record handed to the sink.
   */
  async function write(record: LogRecord,): Promise<void> {
    if (writeDelayMs > 0)
      await wait(writeDelayMs,);
    records.push(record,);
  }

  // `flush` is spread in only when present: under `exactOptionalPropertyTypes`
  // an optional property cannot be assigned an explicit `undefined`.
  const sink: Sink = {
    ...((flush === undefined) ? {} : { flush, }),
    verify,
    write,
  };
  return {
    records,
    sink,
  };
}

/**
 * Maps recorded records down to their messages for concise assertions.
 *
 * @param recording - Recording sink whose messages to read.
 *
 * @returns Messages in arrival order.
 */
function messages({ recording, }: { readonly recording: RecordingSink; },): string[] {
  return recording.records
    .map(function toMessage(record,) {
      return record.message;
    },);
}

await describe({
  name: 'createLogger orchestration',
  children: [
    it({
      name: 'fans each record out to every available sink',
      fn: async () => {
        const a = recordingSink();
        const b = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [a.sink, b.sink,], },);
        await initPromise;

        logger.info('hello',);
        await logger.flush();

        expect(messages({ recording: a, },),)
          .toEqual(['hello',],);
        expect(messages({ recording: b, },),)
          .toEqual(['hello',],);
      },
    },),

    it({
      name: 'buffers a pre-verify record and replays it to a late-verifying sink exactly once',
      fn: async () => {
        const late = recordingSink({
          verify: function verifyLater(): Promise<boolean> {
            // Resolves on a microtask, after the synchronous log call, so the
            // record must buffer and replay rather than write immediately.
            return Promise.resolve(true,);
          },
        },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [late.sink,], },);

        // Logged synchronously, before the async verify resolves: the record
        // must buffer rather than drop, then replay once on verify.
        logger.info('early',);
        expect(late.records,)
          .toEqual([],);

        await initPromise;
        await logger.flush();
        expect(messages({ recording: late, },),)
          .toEqual(['early',],);
      },
    },),

    it({
      name: 'delivers a startup record once to both an immediately-available and a late sink',
      fn: async () => {
        const eager = recordingSink();
        const late = recordingSink({
          verify: function verifyLater(): Promise<boolean> {
            // Resolves on a microtask, after the synchronous log call, so the
            // record must buffer and replay rather than write immediately.
            return Promise.resolve(true,);
          },
        },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [eager.sink, late.sink,], },);

        logger.info('boot',);
        await initPromise;
        await logger.flush();

        // Exactly once each: the eager sink via the immediate write, the late
        // sink via replay. No double-delivery to the eager sink.
        expect(messages({ recording: eager, },),)
          .toEqual(['boot',],);
        expect(messages({ recording: late, },),)
          .toEqual(['boot',],);
      },
    },),

    it({
      name: 'drops a sink whose verify resolves false',
      fn: async () => {
        const off = recordingSink({
          verify: function verifyUnavailable(): Promise<boolean> {
            return Promise.resolve(false,);
          },
        },);
        const on = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [off.sink, on.sink,], },);
        await initPromise;

        logger.info('x',);
        await logger.flush();
        expect(off.records,)
          .toEqual([],);
        expect(messages({ recording: on, },),)
          .toEqual(['x',],);
      },
    },),

    it({
      name: 'drops a sink whose verify throws or rejects',
      fn: async () => {
        const thrower = recordingSink({
          verify: function verifyThrows(): Promise<boolean> {
            // Throws synchronously, before returning a promise; the logger's
            // try around `await verify()` still catches it.
            throw new Error('sync verify failed',);
          },
        },);
        const rejecter = recordingSink({
          verify: async function verifyRejects(): Promise<boolean> {
            // Rejects after a microtask; awaiting it in the logger rejects and
            // is caught.
            await Promise.resolve();
            throw new Error('async verify failed',);
          },
        },);
        const on = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [thrower.sink, rejecter.sink, on.sink,], },);
        await initPromise;

        logger.info('x',);
        await logger.flush();
        expect(thrower.records,)
          .toEqual([],);
        expect(rejecter.records,)
          .toEqual([],);
        expect(messages({ recording: on, },),)
          .toEqual(['x',],);
      },
    },),

    it({
      name: 'throws once initialized with no available backend',
      fn: async () => {
        const off = recordingSink({
          verify: function verifyUnavailable(): Promise<boolean> {
            return Promise.resolve(false,);
          },
        },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [off.sink,], },);
        await initPromise;

        expect(function logWithNoBackend() {
          logger.info('x',);
        },)
          .toThrow('No logging backends available',);
      },
    },),

    it({
      name: 'a rejecting write does not retire the sink',
      fn: async () => {
        /**
         * Write-attempt counter; a retired sink would stop receiving writes,
         * so a second attempt proves the rejection left the backend available.
         */
        const counters: { attempts: number; } = { attempts: 0, };
        const flaky: Sink = {
          verify: function verifyAvailable(): Promise<boolean> {
            return Promise.resolve(true,);
          },
          write: async function write(): Promise<void> {
            counters.attempts++;
            throw new Error('transient write failure',);
          },
        };
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [flaky,], },);
        await initPromise;

        logger.info('one',);
        await logger.flush();
        // Still available, so this neither throws nor is skipped.
        logger.info('two',);
        await logger.flush();

        expect(counters.attempts,)
          .toBe(2,);
      },
    },),

    it({
      name: 'flush drains a still-pending write before resolving',
      fn: async () => {
        const slow = recordingSink({ writeDelayMs: SLOW_WRITE_MS, },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [slow.sink,], },);
        await initPromise;

        logger.info('drains',);
        // The slow write is still parked, so nothing has been recorded yet.
        expect(slow.records,)
          .toEqual([],);

        await logger.flush();
        expect(messages({ recording: slow, },),)
          .toEqual(['drains',],);
      },
    },),

    it({
      name: 'flush runs every available sink flush hook',
      fn: async () => {
        /**
         * Hook-invocation counter proving `flush()` reached the sink's own hook.
         */
        const counters: { flushes: number; } = { flushes: 0, };
        const hooked = recordingSink({
          flush: async function flushHook(): Promise<void> {
            counters.flushes++;
          },
        },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [hooked.sink,], },);
        await initPromise;

        await logger.flush();
        expect(counters.flushes,)
          .toBe(1,);
      },
    },),

    it({
      name: 'a rejecting flush hook disables that sink without failing the aggregate flush',
      fn: async () => {
        const bad = recordingSink({
          flush: async function flushHook(): Promise<void> {
            throw new Error('flush hook failed',);
          },
        },);
        const good = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [bad.sink, good.sink,], },);
        await initPromise;

        await expect(logger.flush(),)
          .resolves
          .toBeUndefined();

        // The rejecting hook retired its sink; subsequent records skip it.
        logger.info('after',);
        await logger.flush();
        expect(bad.records,)
          .toEqual([],);
        expect(messages({ recording: good, },),)
          .toEqual(['after',],);
      },
    },),

    it({
      name: 'writes a mid-init record immediately to an already-available sink and replays it once to a still-verifying sink',
      fn: async () => {
        const eager = recordingSink();
        const late = recordingSink({
          verify: async function verifyLate(): Promise<boolean> {
            // Still parked when the record is logged, so the eager sink (whose
            // microtask verify already resolved) takes the immediate write
            // while this sink only receives the record via replay on verify.
            await wait(SLOW_WRITE_MS,);
            return true;
          },
        },);
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [eager.sink, late.sink,], },);

        // Halfway through the late sink's verify: eager has flipped available,
        // late has not, and `initialize()` has not yet completed.
        await wait(SLOW_WRITE_MS / 2,);
        logger.info('mid',);

        await initPromise;
        await logger.flush();

        // Eager via the immediate mid-init write, late via replay: each exactly
        // once. A regression that replayed startup records to already-available
        // sinks would make `eager` ['mid', 'mid'].
        expect(messages({ recording: eager, },),)
          .toEqual(['mid',],);
        expect(messages({ recording: late, },),)
          .toEqual(['mid',],);
      },
    },),

    it({
      name: 'a synchronously-throwing write does not retire the sink',
      fn: async () => {
        /**
         * Write-attempt counter; a retired sink would stop receiving writes, so
         * a second attempt proves the synchronous throw left it available.
         */
        const counters: { attempts: number; } = { attempts: 0, };
        const flaky: Sink = {
          verify: function verifyAvailable(): Promise<boolean> {
            return Promise.resolve(true,);
          },
          write: function write(): Promise<void> {
            counters.attempts++;
            // Throws synchronously, before returning a promise; the logger's
            // try around the `write()` call swallows it without retiring the
            // sink (distinct from a rejected promise, handled by `trackWrite`).
            throw new Error('synchronous write failure',);
          },
        };
        const on = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [flaky, on.sink,], },);
        await initPromise;

        logger.info('one',);
        await logger.flush();
        // Still available, so this neither throws nor is skipped.
        logger.info('two',);
        await logger.flush();

        expect(counters.attempts,)
          .toBe(2,);
        // The healthy sibling keeps receiving every record.
        expect(messages({ recording: on, },),)
          .toEqual(['one', 'two',],);
      },
    },),

    it({
      name: 'does not run the flush hook of a sink that failed verification',
      fn: async () => {
        /**
         * Flush-hook counter; stays zero because an unavailable sink's hook
         * must be skipped by `flushAll`.
         */
        const counters: { flushes: number; } = { flushes: 0, };
        const off = recordingSink({
          verify: function verifyUnavailable(): Promise<boolean> {
            return Promise.resolve(false,);
          },
          flush: async function flushHook(): Promise<void> {
            counters.flushes++;
          },
        },);
        const on = recordingSink();
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [off.sink, on.sink,], },);
        await initPromise;

        await logger.flush();
        expect(counters.flushes,)
          .toBe(0,);
      },
    },),

    it({
      name: 'throws once initialized with an empty sink list',
      fn: async () => {
        const {
          logger,
          initPromise,
        } = createLogger({ sinks: [], },);
        await initPromise;

        expect(function logWithNoSinks() {
          logger.info('x',);
        },)
          .toThrow('No logging backends available',);
      },
    },),
  ],
},);
