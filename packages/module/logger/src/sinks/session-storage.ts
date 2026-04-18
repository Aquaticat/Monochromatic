import type {
  LogRecord,
  Sink,
} from '../types.ts';

/** Prefix for sessionStorage keys to namespace log entries. */
const STORAGE_KEY_PREFIX = 'monochromatic.log';

/** Counter for unique log entry keys within the session. */
let lineCounter = 0;

/** Caches verification result to avoid repeated checks. */
let verified = false;

/** Whether sessionStorage backend is available for logging. */
let available = true;

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
  if (verified)
    return available;
  verified = true;

  try {
    const testKey = '__monochromatic_verify__';
    const testValue = `test-${Date.now()}`;
    globalThis.sessionStorage.setItem(
      testKey,
      testValue,
    );
    const readBack = globalThis.sessionStorage.getItem(testKey,);
    globalThis.sessionStorage.removeItem(testKey,);
    available = readBack === testValue;
  }
  catch {
    available = false;
  }
  return available;
}

/**
 * Persists a log record to sessionStorage under a counter-incremented key.
 *
 * @param record - log record to persist
 */
function write(record: LogRecord,): void {
  if (!available)
    return;

  try {
    const key = `${STORAGE_KEY_PREFIX}.${lineCounter++}`;
    globalThis.sessionStorage.setItem(
      key,
      JSON.stringify(record,),
    );
  }
  catch {
    // Silently fail if storage is full or unavailable
  }
}

/**
 * SessionStorage sink that writes log records to browser sessionStorage.
 * Writes are synchronous, so no `flush` hook is needed.
 *
 * @example
 * ```ts
 * sessionStorageSink.write({ level: 'info', message: 'user signed in', timestamp: Date.now() });
 * ```
 */
export const sessionStorageSink: Sink = {
  write,
};
