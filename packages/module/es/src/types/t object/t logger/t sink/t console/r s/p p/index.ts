import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

/** Caches verification result to avoid repeated checks. */
let verified = false;

/** Whether console backend is available for logging. */
let available = true;

/**
 * Maps log levels to their corresponding console methods.
 */
const LEVEL_TO_CONSOLE: Record<string, ((...args: readonly unknown[]) => void) | undefined> = {
  debug: console.debug,
  error: console.error,
  fatal: console.error,
  info: console.info,
  trace: console.trace,
  warn: console.warn,
};

/**
 * Verifies console is available and methods don't throw.
 */
export const verify: Verify = (): boolean => {
  if (verified) return available;
  verified = true;

  try {
    if (typeof console === 'undefined') {
      available = false;
      return available;
    }

    const testFn = console.debug;
    if (typeof testFn !== 'function') {
      available = false;
      return available;
    }

    // Actually call it to verify it doesn't throw
    testFn('monochromatic: console sink verification');
    available = true;
  } catch {
    available = false;
  }

  return available;
};

/**
 * Console sink that writes log records to console methods.
 */
export const $: Sink = (record: LogRecord): void => {
  if (!available) return;

  try {
    const consoleFn = LEVEL_TO_CONSOLE[record.level];
    if (typeof consoleFn === 'function') {
      consoleFn(`[${new Date(record.timestamp).toISOString()}] ${record.message}`);
    }
  } catch {
    // Silently fail if console throws
  }
};
