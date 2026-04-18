import type {
  Level,
  LogRecord,
  Sink,
} from '../types.ts';

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
const SILENT_LEVELS: ReadonlySet<string> = new Set([
  'debug',
  'trace',
],);

/**
 * Detects verbose mode from environment variables, process arguments,
 * and runtime environment.
 * Checks `process.env.DEBUG`, `process.argv` for `--verbose`,
 * `import.meta.env.DEBUG`, and whether the runtime is a browser.
 * Browser environments enable verbose by default because DevTools
 * already provides its own log-level filtering, making logger-side
 * suppression redundant. Each check is individually guarded
 * so unavailable globals never cause throws.
 *
 * @returns Whether verbose output is enabled.
 *
 * @example
 * ```ts
 * // With DEBUG=true in environment
 * detectVerbose(); // true
 * ```
 *
 * @example
 * ```ts
 * // In a browser environment (window is defined)
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

  try {
    // Browser DevTools already provides log-level filtering,
    // so suppressing debug/trace at the logger level is redundant.
    if ('window' in globalThis)
      return true;
  }
  catch {
    // window access may throw in restricted contexts - intentionally didn't log to reduce noise.
  }

  return false;
}

/**
 * Lazily-evaluated verbose flag. Evaluating at module load prevents tests
 * (and hosts) from mutating `process.env.DEBUG` between import time and
 * first log. Reading on first `write()` call keeps the check cheap while
 * still letting the harness control the environment before any sink call.
 */
let verboseCache: boolean | null = null;

/**
 * Reads the memoized verbose flag, evaluating on first call.
 *
 * @returns Whether verbose logging is enabled for this process.
 */
function getVerbose(): boolean {
  verboseCache ??= detectVerbose();
  return verboseCache;
}

/**
 * Maps log levels to the name of the console method that handles them.
 * Names rather than function references so tests (and other hot patches)
 * that replace `console.info` etc. after module load still see their
 * replacement when the sink flushes.
 */
const LEVEL_TO_CONSOLE_METHOD: Record<Level,
  'debug' | 'error' | 'info' | 'trace' | 'warn'> = {
    debug: 'debug',
    error: 'error',
    fatal: 'error',
    info: 'info',
    trace: 'trace',
    warn: 'warn',
  };

/**
 * Formats a single log record into the display string used by console output.
 *
 * @param record - Record to format.
 *
 * @returns Formatted line of the shape `[level] [iso] message`.
 *
 * @example
 * ```ts
 * formatRecord({ level: 'info', message: 'hi', timestamp: 0 });
 * // => '[info] [1970-01-01T00:00:00.000Z] hi'
 * ```
 */
function formatRecord(record: LogRecord,): string {
  return `[${record.level}] [${
    new Date(record.timestamp,)
      .toISOString()
  }] ${record.message}`;
}

/**
 * Buffer of records waiting for the next microtask flush. Filter at enqueue
 * keeps silenced `debug`/`trace` spam out of this array entirely so a verbose-
 * disabled process pays no per-log allocation for hidden lines.
 */
const buffer: LogRecord[] = [];

/**
 * Whether a flush has already been scheduled for the current microtask
 * cycle. Prevents redundant `queueMicrotask` registrations when many
 * records arrive in the same synchronous frame.
 */
let scheduled = false;

/**
 * Emits a contiguous run of same-level records as a single console call,
 * joining formatted lines with `\n`.
 *
 * @param records - Records that all share `level`.
 *
 * @param level - Shared severity level whose mapped `console.*` receives
 * the joined text.
 *
 * @example
 * ```ts
 * emitRun([{ level: 'info', message: 'a', timestamp: 0 }], 'info');
 * // calls console.info('[info] [1970-01-01T00:00:00.000Z] a')
 * ```
 */
function emitRun(
  records: readonly LogRecord[],
  level: Level,
): void {
  const text = records
    .map(function formatOne(r,) {
      return formatRecord(r,);
    },)
    .join('\n',);
  try {
    const method = LEVEL_TO_CONSOLE_METHOD[level];
    const consoleFn = console[method];
    if (typeof consoleFn === 'function') {
      consoleFn.call(
        console,
        text,
      );
    }
  }
  catch {
    // Silently fail if console throws
  }
}

/**
 * Drains the buffer, collapsing contiguous same-level runs into single
 * console calls. A sequence `[debug, debug, warn, debug]` becomes three
 * calls: `console.debug` (two lines joined), `console.warn`, then
 * `console.debug`. Typical instrumented functions use a single level
 * throughout, so most flushes collapse to one call.
 *
 * @example
 * ```ts
 * flushBuffer(); // emits whatever is currently buffered
 * ```
 */
function flushBuffer(): void {
  scheduled = false;
  if (buffer.length === 0)
    return;

  const records = buffer.splice(0,);
  const [firstRecord,] = records;
  if (firstRecord === undefined)
    return;

  let runStart = 0;
  let runLevel: Level = firstRecord.level;
  for (let i = 1; i <= records.length; i++) {
    const atEnd = i === records.length;
    const nextRecord = records[i];
    const nextLevel = nextRecord === undefined ? runLevel : nextRecord.level;
    if (!atEnd && nextLevel === runLevel)
      continue;

    emitRun(
      records.slice(
        runStart,
        i,
      ),
      runLevel,
    );
    runStart = i;
    runLevel = nextLevel;
  }
}

/**
 * Verifies console is available and microtask scheduling is supported.
 * `queueMicrotask` is the batching primitive; without it there is no
 * ordering guarantee that preserves "end of current sync frame" semantics,
 * so the sink marks itself unavailable instead of falling back to an
 * inferior scheduler.
 *
 * @returns whether console logging is available
 *
 * @example
 * ```ts
 * if (verifyConsole()) {
 *   consoleSink.write(logRecord);
 * }
 * ```
 */
export function verifyConsole(): boolean {
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

    if (typeof queueMicrotask !== 'function') {
      available = false;
      return available;
    }

    available = true;
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * Enqueues a record for microtask-batched emission.
 * Silently discards `debug`/`trace` unless verbose mode is active
 * (via `DEBUG=true` env var, `--verbose` argv,
 * `import.meta.env.DEBUG === 'true'`, or browser environment).
 *
 * @param record - log record to write
 *
 * @example
 * ```ts
 * consoleSink.write({ level: 'info', message: 'server started', timestamp: Date.now() });
 * ```
 */
function write(record: LogRecord,): void {
  if (!available)
    return;

  if (!getVerbose() && SILENT_LEVELS.has(record.level,))
    return;

  buffer.push(record,);

  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flushBuffer,);
  }
}

/**
 * Test-only hook to clear module-local buffer, schedule flag, and
 * verbose cache between cases. Production code never calls this.
 *
 * @example
 * ```ts
 * __resetForTests();
 * process.env['DEBUG'] = 'true';
 * consoleSink.write({ level: 'info', message: 'x', timestamp: 0 });
 * ```
 */
export function __resetForTests(): void {
  buffer.length = 0;
  scheduled = false;
  verboseCache = null;
  verified = false;
  available = true;
}

/**
 * Forces any buffered records through to the console immediately.
 * Returns an already-resolved promise so call sites can `await $.flush()`
 * uniformly with async sink implementations. Safe to call when the
 * buffer is empty.
 *
 * @example
 * ```ts
 * consoleSink.write({ level: 'error', message: 'crash', timestamp: Date.now() });
 * await consoleSink.flush?.(); // guarantees the line is visible before next step
 * ```
 */
function flush(): Promise<void> {
  flushBuffer();
  return Promise.resolve();
}

/**
 * Microtask-batched console sink. Collapses contiguous same-level runs
 * into single `console.*` calls, sharply reducing DevTools/console-panel
 * overhead when an instrumented path emits many records per sync frame.
 */
export const consoleSink: Sink = {
  flush,
  write,
};
