import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createConsoleSink, } from './console.ts';
import type { LogRecord, } from '../types.ts';

/**
 * Awaits two microtask hops so any pending `queueMicrotask(flushBuffer)`
 * has definitely fired and the buffer is drained before the next assertion.
 * One hop would often be enough, but two is cheap insurance against timing
 * skew from the harness itself.
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
    readonly level: LogRecord['level'];
    readonly message: string;
  },
): LogRecord {
  return {
    level,
    message,
    timestamp: 0,
  };
}

/**
 * Appends `--verbose` to `process.argv` and removes it again when the returned
 * value goes out of `using` scope, so a verbose-detection test cannot leak the
 * flag into the sibling test that asserts the silenced default.
 *
 * @returns Disposable that restores `process.argv` on scope exit.
 */
function withVerboseArgv(): Disposable {
  process.argv
    .push('--verbose',);
  return {
    [Symbol.dispose](): void {
      /**
       * Index of the flag this helper added; `-1` means a concurrent change already removed it, so nothing is spliced.
       */
      const flagIndex = process.argv
        .indexOf('--verbose',);
      if (flagIndex !== -1)
        process.argv
          .splice(
          flagIndex,
          1,
        );
    },
  };
}

await describe({
  name: 'console sink (microtask-batched)',
  // Sequential because every test spies a global (`console.*`); concurrent
  // runs would clobber each other's spies. Sink state is now per-instance
  // (each test builds its own `createConsoleSink()`), so no reset hook or
  // shared-buffer coordination is needed.
  concurrency: 1,
  children: [
    it({
      name: 'verify resolves true in a test environment',
      fn: async () => {
        const sink = createConsoleSink();
        expect(await sink.verify(),)
          .toBe(true,);
      },
    },),

    it({
      name: 'single write defers until next microtask',
      fn: async ({ sinon, },) => {
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        void sink.write(record({
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
      // Regression: WARN=false drops warn records so machine-protocol consumers
      // (such as the toml-edit conformance codec) keep their output clean.
      name: 'WARN=false suppresses warn records',
      fn: async ({ sinon, },) => {
        process.env.WARN = 'false';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'warn',
        );

        void sink.write(record({
          level: 'warn',
          message: 'hushed',
        },),);

        await waitForFlush();
        expect(spy.callCount,)
          .toBe(0,);
        Reflect.deleteProperty(
          process.env,
          'WARN',
        );
      },
    },),

    it({
      name: 'warn records emit when WARN is unset',
      fn: async ({ sinon, },) => {
        Reflect.deleteProperty(
          process.env,
          'WARN',
        );
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'warn',
        );

        void sink.write(record({
          level: 'warn',
          message: 'audible',
        },),);

        await waitForFlush();
        expect(spy.callCount,)
          .toBe(1,);
      },
    },),

    it({
      name: 'contiguous same-level runs collapse to one console call',
      fn: async ({ sinon, },) => {
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        void sink.write(record({
          level: 'info',
          message: 'first',
        },),);
        void sink.write(record({
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
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const debugSpy = sinon.spy(
          console,
          'debug',
        );
        const warnSpy = sinon.spy(
          console,
          'warn',
        );

        void sink.write(record({
          level: 'debug',
          message: 'd1',
        },),);
        void sink.write(record({
          level: 'debug',
          message: 'd2',
        },),);
        void sink.write(record({
          level: 'warn',
          message: 'w1',
        },),);
        void sink.write(record({
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
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        void sink.write(record({
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
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        // Stub (not spy) console.trace: Node's Console.prototype.trace
        // internally calls this.error(stack), so a spied trace would delegate
        // into the spied console.error and inflate the error count by one.
        // The stub still records the routing call (callCount) without that
        // delegation, isolating the sink's level->method mapping from Node's
        // console internals.
        const traceSpy = sinon.stub(
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

        void sink.write(record({
          level: 'trace',
          message: 't',
        },),);
        await waitForFlush();
        void sink.write(record({
          level: 'debug',
          message: 'd',
        },),);
        await waitForFlush();
        void sink.write(record({
          level: 'info',
          message: 'i',
        },),);
        await waitForFlush();
        void sink.write(record({
          level: 'warn',
          message: 'w',
        },),);
        await waitForFlush();
        void sink.write(record({
          level: 'error',
          message: 'e',
        },),);
        await waitForFlush();
        void sink.write(record({
          level: 'fatal',
          message: 'f',
        },),);
        await waitForFlush();

        // Assert the whole count map at once: a future drift reports which
        // method's count changed (e.g. {error: 3} vs {error: 2}) instead of a
        // bare "expected 3 to equal 2". error is 2 because console.error backs
        // both 'error' and 'fatal' (fatal shares the error method). Keys are
        // alphabetized to satisfy oxlint sort-keys.
        expect({
          debug: debugSpy.callCount,
          error: errorSpy.callCount,
          info: infoSpy.callCount,
          trace: traceSpy.callCount,
          warn: warnSpy.callCount,
        },)
          .toEqual({
            debug: 1,
            error: 2,
            info: 1,
            trace: 1,
            warn: 1,
          },);
      },
    },),

    it({
      name: 'silent gating drops debug when verbose is off',
      fn: async ({ sinon, },) => {
        delete process.env.DEBUG;
        // A fresh sink recomputes verbose on its first write, so clearing
        // DEBUG here yields verbose=false (process.argv has no --verbose in a
        // normal test run, and 'window' is not in globalThis under Node).
        const sink = createConsoleSink();
        const debugSpy = sinon.spy(
          console,
          'debug',
        );
        const traceSpy = sinon.spy(
          console,
          'trace',
        );

        void sink.write(record({
          level: 'debug',
          message: 'hidden',
        },),);
        void sink.write(record({
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
      name: '--verbose in process.argv enables debug output without DEBUG',
      fn: async ({ sinon, },) => {
        delete process.env.DEBUG;
        // A fresh sink recomputes verbose on its first write; with DEBUG unset
        // and no browser `window`, the --verbose argv flag is the sole trigger.
        using _restoreArgv = withVerboseArgv();
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'debug',
        );

        void sink.write(record({
          level: 'debug',
          message: 'shown',
        },),);
        await waitForFlush();

        expect(spy.callCount,)
          .toBe(1,);
      },
    },),

    it({
      name: 'cross-microtask writes produce separate console calls',
      fn: async ({ sinon, },) => {
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        void sink.write(record({
          level: 'info',
          message: 'first',
        },),);
        await waitForFlush();
        void sink.write(record({
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
        process.env.DEBUG = 'true';
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        void sink.write(record({
          level: 'info',
          message: 'force-drain',
        },),);
        expect(spy.callCount,)
          .toBe(0,);

        await sink.flush?.();
        expect(spy.callCount,)
          .toBe(1,);
      },
    },),

    it({
      name: 'flush() on empty buffer resolves without emitting',
      fn: async ({ sinon, },) => {
        const sink = createConsoleSink();
        const spy = sinon.spy(
          console,
          'info',
        );

        await sink.flush?.();
        expect(spy.callCount,)
          .toBe(0,);
      },
    },),
  ],
},);
