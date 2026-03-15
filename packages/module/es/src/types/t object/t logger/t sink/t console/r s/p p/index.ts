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
 * Levels silenced by default unless verbose mode is active.
 *
 * @example
 * ```ts
 * SILENT_LEVELS.has('trace'); // true
 * SILENT_LEVELS.has('info');  // false
 * ```
 */
const SILENT_LEVELS: ReadonlySet<string> = new Set(['debug', 'trace',],);

/**
 * Detects verbose mode from environment variables and process arguments.
 * Checks `process.env.DEBUG`, `process.argv` for `--verbose`,
 * and `import.meta.env.DEBUG`. Each check is individually guarded
 * so unavailable globals never cause throws.
 *
 * @returns Whether verbose output is enabled.
 *
 * @example
 * ```ts
 * // With DEBUG=true in environment
 * detectVerbose(); // true
 * ```
 */
function detectVerbose(): boolean {
  try {
    if (typeof process !== 'undefined' && process.env['DEBUG'] === 'true')
      return true;
  }
  catch {
    // process may be restricted or unavailable - intentionally didn't log to reduce noise.
  }

  try {
    if (typeof process !== 'undefined'
      && Array.isArray(process.argv,)
      && process.argv.includes('--verbose',))
    {
      return true;
    }
  }
  catch {
    // process.argv may be restricted or unavailable - intentionally didn't log to reduce noise.
  }

  try {
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- import.meta.env may not exist in all runtimes
    if (import.meta?.env?.['DEBUG'] === 'true')
      return true;
  }
  catch {
    // import.meta.env may be unavailable - intentionally didn't log to reduce noise.
  }

  return false;
}

/** Cached verbose mode flag, evaluated once at module load. */
const verbose: boolean = detectVerbose();

/**
 * Maps log levels to their corresponding console methods.
 */
const LEVEL_TO_CONSOLE: Record<string,
  ((...args: readonly unknown[]) => void) | undefined> = {
    debug: console.debug,
    error: console.error,
    fatal: console.error,
    info: console.info,
    trace: console.trace,
    warn: console.warn,
  };

/**
 * Verifies console is available and methods don't throw.
 *
 * @returns whether console logging is available
 */
export function verify(): boolean {
  if (verified)
    return available;
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
    // data is intentionally an empty string to avoid unnecessary noise.
    // Edit: This still produces one blank line on the invocation of any program, which is kinda ugly. And in practice this never fails, disabled for now. If some runtime start failing console logs we'll re-enable.
    // testFn('');
    available = true;
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * Console sink that writes log records to console methods.
 * Silently swallows debug and trace logs unless verbose mode
 * is active (via `DEBUG=true` env var, `--verbose` argv, or
 * `import.meta.env.DEBUG === 'true'`).
 *
 * @param record - log record to write
 */
export function $(record: LogRecord,): void {
  if (!available)
    return;

  // Silently discard debug/trace unless verbose mode is active
  if (!verbose && SILENT_LEVELS.has(record.level,))
    return;

  try {
    const consoleFn = LEVEL_TO_CONSOLE[record.level];
    if (typeof consoleFn === 'function') {
      consoleFn(
        `[${record.level}] [${
          new Date(record.timestamp,)
            .toISOString()
        }] ${record.message}`,
      );
    }
  }
  catch {
    // Silently fail if console throws
  }
}
