import type {
  Level,
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Module-local mutable state grouped in a `const` container so module-root
 * state stays out of a top-level `let` (`no-module-root-let` would otherwise
 * reject it). `verified` short-circuits repeat verification; `available`
 * flips false on a failed verification or a runtime throw; `verboseCache`
 * lazily memoizes the verbose-mode detection (null sentinel = not yet
 * computed); `scheduled` guards against redundant `queueMicrotask` calls
 * within the same sync frame.
 */
const state: {
  verified: boolean;
  available: boolean;
  verboseCache: boolean | null;
  scheduled: boolean;
} = {
  available: true,
  scheduled: false,
  verboseCache: null,
  verified: false,
};

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
    if (((typeof process) !== 'undefined') && (process.env
      .DEBUG
      === 'true'))
      return true;
  }
  catch {
    // process may be restricted or unavailable - intentionally didn't log to reduce noise.
  }

  try {
    if (((typeof process) !== 'undefined')
      && Array
      .isArray(process.argv,)
      && process
      .argv
      .includes('--verbose',))
    {
      return true;
    }
  }
  catch {
    // process.argv may be restricted or unavailable - intentionally didn't log to reduce noise.
  }

  try {
    if (import.meta?.env
      ?.DEBUG
      === 'true')
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
 * Reads the memoized verbose flag, evaluating on first call.
 * Lazily evaluated rather than at module load so tests (and hosts) can
 * mutate `process.env.DEBUG` between import time and first log without
 * stale cache. Cache lives on `state.verboseCache`.
 *
 * @returns Whether verbose logging is enabled for this process.
 */
function getVerbose(): boolean {
  state.verboseCache ??= detectVerbose();
  return state.verboseCache;
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
 * emitRun({ records: [{ level: 'info', message: 'a', timestamp: 0 }], level: 'info' });
 * // calls console.info('[info] [1970-01-01T00:00:00.000Z] a')
 * ```
 */
function emitRun(
  {
    records,
    level,
  }: {
    records: readonly LogRecord[];
    level: Level;
  },
): void {
  /** Joined run text; one `\n`-separated string per console call so a long run becomes a single grouped entry rather than N separate ones. */
  const text = records
    .map(function formatOne(r,) {
      return formatRecord(r,);
    },)
    .join('\n',);
  try {
    /** Name (not the function reference) of the matching `console.*` method; resolved lazily so post-import hot patches still apply. */
    const method = LEVEL_TO_CONSOLE_METHOD[level];
    /** Resolved console method looked up by name; may be missing or non-callable in stripped runtimes, which the guard handles. */
    const consoleFn = console[method];
    if ((typeof consoleFn) === 'function') {
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
 * A contiguous slice of buffered records that share one level. Built by
 * `groupRuns` and consumed by `flushBuffer` to emit one `console.*` call
 * per slice.
 */
type Run = {
  level: Level;
  records: LogRecord[];
};

/**
 * Groups a record sequence into contiguous same-level runs. Each input
 * record is appended to the trailing run when its level matches, otherwise
 * a new run is opened. A reduce-based collapse keeps the cursor (run head
 * and span) out of mutable function-body locals.
 *
 * @param records - Buffered records in arrival order.
 *
 * @returns Ordered list of runs covering every input record exactly once.
 *
 * @example
 * ```ts
 * groupRuns([
 *   { level: 'debug', message: 'a', timestamp: 0 },
 *   { level: 'debug', message: 'b', timestamp: 0 },
 *   { level: 'warn',  message: 'c', timestamp: 0 },
 * ]);
 * // => [{ level: 'debug', records: [a, b] }, { level: 'warn', records: [c] }]
 * ```
 */
function groupRuns(records: readonly LogRecord[],): Run[] {
  return records.reduce<Run[]>(
    function appendToRuns(
      runs,
      record,
    ) {
      /** Trailing run being extended; new same-level records append onto it, otherwise a fresh run is opened. */
      const tail = runs.at(-1,);
      if ((tail !== undefined) && (tail.level
        === record
        .level)) {
        tail.records
          .push(record,);
        return runs;
      }
      runs.push({
        level: record.level,
        records: [record,],
      },);
      return runs;
    },
    [],
  );
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
  state.scheduled = false;
  if (buffer.length
    === 0)
    return;

  /**
   * Snapshot of buffered records drained before the loop.
   *
   * Using `splice(0)` empties the buffer atomically so any record enqueued
   * during emission lands in the next flush rather than this one.
   */
  const records = buffer.splice(0,);
  for (const run of groupRuns(records,)) {
    emitRun({
      level: run.level,
      records: run.records,
    },);
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
  if (state.verified)
    return state.available;
  state.verified = true;

  try {
    if ((typeof console) === 'undefined') {
      state.available = false;
      return state.available;
    }

    /** Sample `console.debug` reference used only to check the method actually exists in the host; absent in some stripped runtimes. */
    const testFn = console.debug;
    if ((typeof testFn) !== 'function') {
      state.available = false;
      return state.available;
    }

    if ((typeof queueMicrotask) !== 'function') {
      state.available = false;
      return state.available;
    }

    state.available = true;
  }
  catch {
    state.available = false;
  }

  return state.available;
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
  if (!state.available)
    return;

  if ((!getVerbose()) && SILENT_LEVELS
    .has(record.level,))
    return;

  buffer.push(record,);

  if (!state.scheduled) {
    state.scheduled = true;
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
  state.scheduled = false;
  state.verboseCache = null;
  state.verified = false;
  state.available = true;
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
