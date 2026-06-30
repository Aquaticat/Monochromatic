import { reportLoggerInternalError, } from '../error-format.ts';

import type {
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Prefix for sessionStorage keys to namespace log entries.
 */
const STORAGE_KEY_PREFIX = 'monochromatic.log';

/**
 * Verifies sessionStorage actually persists data. Stateless: the logger calls
 * this once per sink at startup and owns the resulting availability, so no
 * verified/available flag is kept here.
 *
 * @returns Whether sessionStorage is available and round-trips a probe write.
 *
 * @example
 * ```ts
 * if (await verifySessionStorage()) {
 *   // sessionStorage usable
 * }
 * ```
 */
function verifySessionStorage(): Promise<boolean> {
  try {
    /**
     * Sentinel key used only for the probe write/read; removed afterward to avoid polluting real log entries.
     */
    const testKey = '__monochromatic_verify__';
    /**
     * Timestamp-based probe value so concurrent verifications never read each other's writes.
     */
    const testValue = `test-${Date.now()}`;
    globalThis.sessionStorage
      .setItem(
      testKey,
      testValue,
    );
    /**
     * Probe value read back from storage; equality with `testValue` proves writes actually persist.
     */
    const readBack = globalThis.sessionStorage
      .getItem(testKey,);
    globalThis.sessionStorage
      .removeItem(testKey,);
    return Promise.resolve(readBack === testValue,);
  }
  catch (error: unknown) {
    if ('window' in globalThis)
      reportLoggerInternalError({
        context: 'sessionStorage sink verification failed',
        error,
      },);
    return Promise.resolve(false,);
  }
}

/**
 * Builds a sessionStorage sink that writes each record under a
 * counter-incremented key. The line counter lives in this instance's closure
 * (no module-global state), so independent loggers and tests never share keys
 * or need a reset hook. Writes persist immediately, so no `flush` hook is
 * exposed.
 *
 * @returns Sink backed by browser `sessionStorage`.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createSessionStorageSink()] });
 * logger.info('user signed in');
 * ```
 */
export function createSessionStorageSink(): Sink {
  /**
   * Instance-local key counter; increments per write to keep keys unique.
   */
  const state: { lineCounter: number; } = { lineCounter: 0, };

  /**
   * Persists a log record to sessionStorage under a counter-incremented key.
   * The logger only writes to verified-available sinks, so no availability
   * guard is needed here.
   *
   * @param record - Log record to persist.
   */
  function write(record: LogRecord,): Promise<void> {
    try {
      /**
       * Counter-incremented storage key so each log entry occupies its own slot; the prefix namespaces them.
       */
      const key = `${STORAGE_KEY_PREFIX}.${state.lineCounter++}`;
      globalThis.sessionStorage
        .setItem(
        key,
        JSON.stringify(record,),
      );
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'sessionStorage sink record write failed',
        error,
      },);
    }

    return Promise.resolve();
  }

  return {
    verify: verifySessionStorage,
    write,
  };
}
