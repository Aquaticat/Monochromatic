import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { LogRecord, } from '../types.ts';
import {
  __resetForTests,
  consoleSink,
  verifyConsole,
} from './console.ts';

/**
 * Awaits two microtask hops so any pending `queueMicrotask(flushBuffer)`
 * has definitely fired and the buffer is drained before the next test
 * begins. One hop would often be enough, but two is cheap insurance
 * against timing skew from the harness itself.
 */
async function waitForFlush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Builds a `LogRecord` with a fixed timestamp so the formatted output
 * is stable across test runs.
 *
 * @param level - Severity level.
 *
 * @param message - Message body.
 *
 * @returns A complete `LogRecord`.
 */
function record(
  {
    level,
    message,
  }: {
    level: LogRecord['level'];
    message: string;
  },
): LogRecord {
  return {
    level,
    message,
    timestamp: 0,
  };
}

await describe({
  name: 'console sink (microtask-batched)',
  // Sequential because every test mutates shared module-level state
  // (buffer, scheduled flag, verboseCache, process.env.DEBUG) and
  // spies a global (`console`). Concurrent runs clobber each other.
  concurrency: 1,
  children: [
    it({
      name: 'verify returns true in a test environment',
      fn: async () => {
        __resetForTests();
        expect(verifyConsole(),)
          .toBe(true,);
      },
    },),

    it({
      name: 'single write defers until next microtask',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const spy = sinon.spy(
          console,
          'info',
        );

        void consoleSink.write(record({
          level: 'info',
          message: 'deferred',
        },),);
        expect(spy.callCount,)
          .toBe(0,);

        await waitForFlush();
        expect(spy.callCount,)
          .toBe(1,);
      },
    },),

    it({
      name: 'contiguous same-level runs collapse to one console call',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const spy = sinon.spy(
          console,
          'info',
        );

        void consoleSink.write(record({
          level: 'info',
          message: 'first',
        },),);
        void consoleSink.write(record({
          level: 'info',
          message: 'second',
        },),);

        await waitForFlush();
        expect(spy.callCount,)
          .toBe(1,);
        const emitted = spy.firstCall.args[0] as string;
        expect(emitted.split('\n',).length,)
          .toBe(2,);
        expect(emitted,)
          .toContain('first',);
        expect(emitted,)
          .toContain('second',);
      },
    },),

    it({
      name: 'level transitions split into separate console calls',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const debugSpy = sinon.spy(
          console,
          'debug',
        );
        const warnSpy = sinon.spy(
          console,
          'warn',
        );

        void consoleSink.write(record({
          level: 'debug',
          message: 'd1',
        },),);
        void consoleSink.write(record({
          level: 'debug',
          message: 'd2',
        },),);
        void consoleSink.write(record({
          level: 'warn',
          message: 'w1',
        },),);
        void consoleSink.write(record({
          level: 'debug',
          message: 'd3',
        },),);

        await waitForFlush();
        expect(debugSpy.callCount,)
          .toBe(2,);
        expect(warnSpy.callCount,)
          .toBe(1,);
        const firstDebug = debugSpy.firstCall.args[0] as string;
        const secondDebug = debugSpy.secondCall.args[0] as string;
        expect(firstDebug.split('\n',).length,)
          .toBe(2,);
        expect(secondDebug.split('\n',).length,)
          .toBe(1,);
      },
    },),

    it({
      name: 'formats each record as [level] [iso] message',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const spy = sinon.spy(
          console,
          'info',
        );

        void consoleSink.write(record({
          level: 'info',
          message: 'hi',
        },),);
        await waitForFlush();

        const emitted = spy.firstCall.args[0] as string;
        expect(emitted,)
          .toBe('[info] [1970-01-01T00:00:00.000Z] hi',);
      },
    },),

    it({
      name: 'each level routes to its mapped console method',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const traceSpy = sinon.spy(
          console,
          'trace',
        );
        const debugSpy = sinon.spy(
          console,
          'debug',
        );
        const infoSpy = sinon.spy(
          console,
          'info',
        );
        const warnSpy = sinon.spy(
          console,
          'warn',
        );
        const errorSpy = sinon.spy(
          console,
          'error',
        );

        void consoleSink.write(record({
          level: 'trace',
          message: 't',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'debug',
          message: 'd',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'info',
          message: 'i',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'warn',
          message: 'w',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'error',
          message: 'e',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'fatal',
          message: 'f',
        },),);
        await waitForFlush();

        expect(traceSpy.callCount,)
          .toBe(1,);
        expect(debugSpy.callCount,)
          .toBe(1,);
        expect(infoSpy.callCount,)
          .toBe(1,);
        expect(warnSpy.callCount,)
          .toBe(1,);
        // fatal routes to console.error, so error spy fires twice (error + fatal)
        expect(errorSpy.callCount,)
          .toBe(2,);
      },
    },),

    it({
      name: 'silent gating drops debug when verbose is off',
      fn: async ({ sinon, },) => {
        __resetForTests();
        delete process.env.DEBUG;
        // Force-evaluate verbose with DEBUG cleared. Without this,
        // an earlier test that set DEBUG=true and called getVerbose
        // could already have poisoned the cache via __resetForTests
        // clearing it. Here the reset plus env clear yields verbose=false
        // on the next getVerbose call (process.argv won't contain --verbose
        // in a normal test run, and 'window' is not in globalThis under Node).
        const debugSpy = sinon.spy(
          console,
          'debug',
        );
        const traceSpy = sinon.spy(
          console,
          'trace',
        );

        void consoleSink.write(record({
          level: 'debug',
          message: 'hidden',
        },),);
        void consoleSink.write(record({
          level: 'trace',
          message: 'hidden',
        },),);

        await waitForFlush();
        expect(debugSpy.callCount,)
          .toBe(0,);
        expect(traceSpy.callCount,)
          .toBe(0,);
      },
    },),

    it({
      name: 'cross-microtask writes produce separate console calls',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const spy = sinon.spy(
          console,
          'info',
        );

        void consoleSink.write(record({
          level: 'info',
          message: 'first',
        },),);
        await waitForFlush();
        void consoleSink.write(record({
          level: 'info',
          message: 'second',
        },),);
        await waitForFlush();

        expect(spy.callCount,)
          .toBe(2,);
      },
    },),

    it({
      name: 'flush() drains synchronously before the await resolves',
      fn: async ({ sinon, },) => {
        __resetForTests();
        process.env.DEBUG = 'true';
        const spy = sinon.spy(
          console,
          'info',
        );

        void consoleSink.write(record({
          level: 'info',
          message: 'force-drain',
        },),);
        expect(spy.callCount,)
          .toBe(0,);

        await consoleSink.flush?.();
        expect(spy.callCount,)
          .toBe(1,);
      },
    },),

    it({
      name: 'flush() on empty buffer resolves without emitting',
      fn: async ({ sinon, },) => {
        __resetForTests();
        const spy = sinon.spy(
          console,
          'info',
        );

        await consoleSink.flush?.();
        expect(spy.callCount,)
          .toBe(0,);
      },
    },),
  ],
},);
