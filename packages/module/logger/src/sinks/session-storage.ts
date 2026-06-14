import type {
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Prefix for sessionStorage keys to namespace log entries.
 */
const STORAGE_KEY_PREFIX = 'monochromatic.log';

/**
 * Module-local mutable state grouped in a `const` container so module-root
 * state stays out of a top-level `let` (`no-module-root-let` would otherwise
 * reject it). `lineCounter` increments per write to keep keys unique;
 * `verified` short-circuits repeat verification; `available` flips false on
 * a failed verification or a runtime throw.
 */
const state: {
  lineCounter: number;
  verified: boolean;
  available: boolean;
} = {
  available: true,
  lineCounter: 0,
  verified: false,
};

/**
 * Verifies sessionStorage actually persists data.
 *
 * @returns whether sessionStorage is available and functional
 *
 * @example
 * ```ts
 * if (verifySessionStorage()) {
 *   sessionStorageSink.write(logRecord);
 * }
 * ```
 */
export function verifySessionStorage(): boolean {
  if (state.verified)
    return state.available;
  state.verified = true;

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
    state.available = readBack === testValue;
  }
  catch {
    state.available = false;
  }
  return state.available;
}

/**
 * Persists a log record to sessionStorage under a counter-incremented key.
 *
 * @param record - log record to persist
 */
function write(record: LogRecord,): Promise<void> {
  if (!state.available)
    return Promise.resolve();

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
  catch {
    // Silently fail if storage is full or unavailable
  }

  return Promise.resolve();
}

/**
 * SessionStorage sink that writes log records to browser sessionStorage.
 * Writes persist immediately with no buffering, so no `flush` hook is needed.
 *
 * @example
 * ```ts
 * sessionStorageSink.write({ level: 'info', message: 'user signed in', timestamp: Date.now() });
 * ```
 */
export const sessionStorageSink: Sink = {
  verify: verifySessionStorage,
  write,
};
