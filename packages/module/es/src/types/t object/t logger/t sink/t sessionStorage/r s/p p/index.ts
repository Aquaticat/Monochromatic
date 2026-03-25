import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

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
 */
export function verify(): boolean {
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
 * SessionStorage sink that writes log records to browser sessionStorage.
 *
 * @param record - log record to persist
 */
export function $(record: LogRecord,): void {
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
