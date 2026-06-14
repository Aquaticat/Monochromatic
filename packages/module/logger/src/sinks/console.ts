import type {
  Level,
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Sentinel for an uncomputed `verboseCache` slot. A unique `Symbol` rather
 * than `null`: the `no-nullish-union` rule bans a nullish "absent" arm, and
 * a real `boolean` value is the computed state this must stay distinct from.
 */
const VERBOSE_UNCOMPUTED = Symbol('logger:verbose-detection-uncomputed',);

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
 * and whether the runtime is a browser.
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
 * Detects explicit warn suppression via the `WARN` environment variable.
 *
 * Setting `WARN=false` drops `warn`-level records, for machine-protocol
 * consumers (such as a stdin/stdout codec) whose output streams must stay clean
 * on success. Only the exact string `'false'` suppresses; any other value, or an
 * absent variable, leaves `warn` enabled. Read on each call (not memoized) so a
 * host can toggle it between logs.
 *
 * @returns Whether `warn`-level records are suppressed.
 *
 * @example
 * ```ts
 * // With WARN=false in environment
 * isWarnSuppressed(); // true
 * ```
 */
function isWarnSuppressed(): boolean {
  try {
    return ((typeof process) !== 'undefined') && (process.env
      .WARN
      === 'false');
  }
  catch {
    // process may be restricted or unavailable - leave warn enabled.
    return false;
  }
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
    readonly records: readonly LogRecord[];
    readonly level: Level;
  },
): void {
  /**
   * Joined run text; one `\n`-separated string per console call so a long run becomes a single grouped entry rather than N separate ones.
   */
  const text = records
    .map(function formatOne(r,) {
      return formatRecord(r,);
    },)
    .join('\n',);
  try {
    /**
     * Name (not the function reference) of the matching `console.*` method; resolved lazily so post-import hot patches still apply.
     */
    const method = LEVEL_TO_CONSOLE_METHOD[level];
    /**
     * Resolved console method looked up by name; may be missing or non-callable in stripped runtimes, which the guard handles.
     */
    const consoleFn = console[method];
    if ((typeof consoleFn) === 'function') {
      consoleFn.call(
        console,
        text,
      );
    }
  }
  catch {
    // Silently fail if console throws.
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
      /**
       * Trailing run being extended; new same-level records append onto it, otherwise a fresh run is opened.
       */
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
 * Verifies console is available and microtask scheduling is supported.
 * `queueMicrotask` is the batching primitive; without it there is no
 * ordering guarantee that preserves "end of current sync frame" semantics,
 * so the sink reports itself unavailable instead of falling back to an
 * inferior scheduler. Stateless: the logger calls this once and owns the
 * resulting availability.
 *
 * @returns Whether console logging is available.
 *
 * @example
 * ```ts
 * if (await verifyConsole()) {
 *   // console usable
 * }
 * ```
 */
function verifyConsole(): Promise<boolean> {
  try {
    if ((typeof console) === 'undefined')
      return Promise.resolve(false,);

    /**
     * Sample `console.debug` reference used only to check the method actually exists in the host; absent in some stripped runtimes.
     */
    const testFn = console.debug;
    if ((typeof testFn) !== 'function')
      return Promise.resolve(false,);

    if ((typeof queueMicrotask) !== 'function')
      return Promise.resolve(false,);

    return Promise.resolve(true,);
  }
  catch {
    return Promise.resolve(false,);
  }
}

/**
 * Builds a microtask-batched console sink. The pending buffer, schedule flag,
 * and memoized verbose detection live in this instance's closure (no
 * module-global state), so independent loggers and tests stay isolated with
 * no reset hook. Collapses contiguous same-level runs into single `console.*`
 * calls, sharply reducing console-panel overhead when an instrumented path
 * emits many records per sync frame.
 *
 * @returns Sink that writes formatted lines to `console.*`.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createConsoleSink()] });
 * logger.info('server started');
 * ```
 */
export function createConsoleSink(): Sink {
  /**
   * Instance-local console-sink state. `buffer` holds records awaiting the
   * next microtask flush; `scheduled` guards against redundant
   * `queueMicrotask` calls within one sync frame; `verboseCache` memoizes
   * verbose detection (the sentinel means not yet computed) so a host can
   * mutate `process.env.DEBUG` before the first log and still be seen.
   */
  const state: {
    buffer: LogRecord[];
    scheduled: boolean;
    verboseCache: boolean | typeof VERBOSE_UNCOMPUTED;
  } = {
    buffer: [],
    scheduled: false,
    verboseCache: VERBOSE_UNCOMPUTED,
  };

  /**
   * Reads the memoized verbose flag, evaluating on first call. Lazy rather
   * than at construction so tests (and hosts) can mutate `process.env.DEBUG`
   * between construction and first log without a stale cache.
   *
   * @returns Whether verbose logging is enabled for this process.
   */
  function getVerbose(): boolean {
    /**
     * Cached verbose flag; the sentinel means detection has not run yet.
     */
    const cached = state.verboseCache;
    if (cached !== VERBOSE_UNCOMPUTED)
      return cached;
    /**
     * Computed verbose flag, stored so subsequent reads skip detection.
     */
    const computed = detectVerbose();
    state.verboseCache = computed;
    return computed;
  }

  /**
   * Drains the buffer, collapsing contiguous same-level runs into single
   * console calls. A sequence `[debug, debug, warn, debug]` becomes three
   * calls: `console.debug` (two lines joined), `console.warn`, then
   * `console.debug`. Typical instrumented functions use a single level
   * throughout, so most flushes collapse to one call.
   */
  function flushBuffer(): void {
    state.scheduled = false;
    if (state.buffer
      .length
      === 0)
      return;

    /**
     * Snapshot of buffered records drained before the loop.
     *
     * Using `splice(0)` empties the buffer atomically so any record enqueued
     * during emission lands in the next flush rather than this one.
     */
    const records = state.buffer
      .splice(0,);
    for (const run of groupRuns(records,)) {
      emitRun({
        level: run.level,
        records: run.records,
      },);
    }
  }

  /**
   * Enqueues a record for microtask-batched emission. Silently discards
   * `debug`/`trace` unless verbose mode is active (via `DEBUG=true` env var,
   * `--verbose` argv, or browser environment), and drops `warn` when
   * `WARN=false`.
   *
   * @param record - Log record to write.
   */
  function write(record: LogRecord,): Promise<void> {
    if ((!getVerbose()) && SILENT_LEVELS
      .has(record.level,))
      return Promise.resolve();

    if ((record.level === 'warn') && isWarnSuppressed())
      return Promise.resolve();

    state.buffer
      .push(record,);

    if (!state.scheduled) {
      state.scheduled = true;
      queueMicrotask(flushBuffer,);
    }

    return Promise.resolve();
  }

  /**
   * Forces any buffered records through to the console immediately. Returns an
   * already-resolved promise so call sites await uniformly with async sinks.
   * Safe to call when the buffer is empty.
   */
  function flush(): Promise<void> {
    flushBuffer();
    return Promise.resolve();
  }

  return {
    flush,
    verify: verifyConsole,
    write,
  };
}
