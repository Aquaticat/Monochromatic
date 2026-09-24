import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createLogger,
  sinks,
} from '../dist/final/neutral/index.mjs';

/**
 Provides a fixed record for checking fallback console output.

 @param level - Severity to route.
 @returns Record with deterministic display timestamp.
 @example
 ```ts
 makeRecord({ level: 'info' });
 ```
 */
function makeRecord({ level, }: { readonly level: 'error' | 'fatal' | 'info' | 'warn'; },) {
  return {
    level,
    message: 'QuickJS console fallback',
    timestamp: 0,
  };
}

await describe({
  name: 'QuickJS-compatible console and timerless logger',
  concurrency: 1,
  children: [
    it({
      name: 'console.log alone verifies and receives every unsuppressed severity',
      fn: async ({ sinon, },) => {
        const log = sinon.stub(console, 'log');
        sinon.stub(console, 'info').value(undefined);
        sinon.stub(console, 'warn').value(undefined);
        sinon.stub(console, 'error').value(undefined);
        sinon.stub(console, 'trace').value(undefined);
        sinon.stub(console, 'debug').value(undefined);
        const sink = sinks.createConsoleSink();
        expect(await sink.verify(),).toBe(true,);
        for (const level of ['info', 'warn', 'error', 'fatal',] as const)
          await sink.write(makeRecord({ level, },),);
        await sink.flush?.();
        expect(log.callCount,).toBe(4,);
        expect(log.getCalls().map(function firstArg(call,) {
          return String(call.args[0],);
        },),).toEqual([
          '[info] [1970-01-01T00:00:00.000Z] QuickJS console fallback',
          '[warn] [1970-01-01T00:00:00.000Z] QuickJS console fallback',
          '[error] [1970-01-01T00:00:00.000Z] QuickJS console fallback',
          '[fatal] [1970-01-01T00:00:00.000Z] QuickJS console fallback',
        ],);
      },
    },),
    it({
      name: 'logging and flushing work without a global timer',
      fn: async ({ sinon, },) => {
        const log = sinon.stub(console, 'log');
        sinon.stub(console, 'info').value(undefined);
        sinon.stub(console, 'debug').value(undefined);
        sinon.stub(globalThis, 'setTimeout').value(undefined);
        const { logger, initPromise, } = createLogger({
          sinks: [sinks.createConsoleSink(),],
        },);
        logger.info('timerless log',);
        await initPromise;
        await logger.flush();
        expect(log.callCount,).toBe(1,);
        expect(String(log.firstCall.args[0],),).toContain('timerless log',);
      },
    },),
    it({
      name: 'internal failures use console.log when console.warn is missing',
      fn: async ({ sinon, },) => {
        const log = sinon.stub(console, 'log');
        sinon.stub(console, 'warn').value(undefined);
        const { initPromise, } = createLogger({
          sinks: [{
            verify: function failedVerify(): Promise<boolean> {
              throw new Error('probe failed',);
            },
            write: function unusedWrite(): Promise<void> {
              return Promise.resolve();
            },
          },],
        },);
        await initPromise;
        expect(log.callCount,).toBe(1,);
        expect(String(log.firstCall.args[0],),).toContain('probe failed',);
      },
    },),
  ],
},);
