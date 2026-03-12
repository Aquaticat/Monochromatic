/**
 * Unified staleness detection for task-depends.
 *
 * Both `-s` (source) and `-o` (output) items resolve to timestamps.
 * Items can be file globs or `sh:` prefixed shell commands.
 *
 * Shell commands must output a parseable timestamp on stdout:
 * unix epoch (seconds or ms), ISO 8601, `Infinity`, or `-Infinity`.
 * Non-zero exit codes and unparseable output are treated as errors,
 * preventing silent misinterpretation of unexpected command failures.
 *
 * File globs resolve to file modification times.
 * Empty globs contribute no timestamps (empty array).
 *
 * Timestamps are aggregated per-side using configurable strategies
 * (`newest`/`oldest`), then compared: `sourceTime > outputTime` → stale.
 *
 * @example
 * ```ts
 * const stale = await checkStaleness({
 *   sources: ['src/*.ts'],
 *   outputs: ['sh:podman image exists img && echo Infinity || echo -Infinity'],
 *   verbose: false,
 *   sourceTimeStrategy: 'newest',
 *   outputTimeStrategy: 'newest',
 * });
 * ```
 */

// File exceeds 200-line target: staleness resolution is a single cohesive pipeline
// (parse → classify → resolve → aggregate → compare) that does not split cleanly.

import { stat, } from 'node:fs/promises';
import { resolve, } from 'node:path';

import { outdent, } from '@cspotcode/outdent';
import spawn from 'nano-spawn';
import readdirGlob from 'tiny-readdir-glob';

export {};

//region Constants

/** Prefix that identifies a shell command item */
const SH_PREFIX = 'sh:';

/**
 * Boundary for distinguishing unix seconds from milliseconds.
 *
 * Numbers >= 1e12 are treated as milliseconds (dates after 2001 in ms).
 * Numbers < 1e12 are treated as seconds and multiplied by 1000.
 */
const SECONDS_MS_BOUNDARY = 1e12;

//endregion Constants

//region Types

/**
 * Aggregation strategy for reducing multiple timestamps to a single value.
 *
 * Builtin strategies:
 * - `newest`: `Math.max` — most recent timestamp wins
 * - `oldest`: `Math.min` — least recent timestamp wins
 * - `mean`: arithmetic mean — average timestamp across all items
 * - `median`: middle value — central timestamp, robust to outliers
 *
 * Custom strategies use `sh:` prefix: the command receives all resolved
 * timestamps as space-separated arguments and must output a single timestamp.
 *
 * @example
 * ```ts
 * const builtin: TimeStrategy = 'newest';
 * const custom: TimeStrategy = 'sh:node -e "console.log(Math.max(...process.argv.slice(2)))"';
 * ```
 */
export type BuiltinTimeStrategy = 'newest' | 'oldest' | 'mean' | 'median';

/**
 * Time aggregation strategy: a builtin name or a `sh:` command.
 *
 * @example
 * ```ts
 * const s: TimeStrategy = 'newest';
 * const c: TimeStrategy = 'sh:custom-aggregator';
 * ```
 */
export type TimeStrategy = BuiltinTimeStrategy | `sh:${string}`;

//endregion Types

//region Item classification

/**
 * Checks whether an item is a shell command (prefixed with `sh:`).
 *
 * @param item - Source or output item string
 * @returns `true` when the item starts with `sh:`
 *
 * @example
 * ```ts
 * isShellCommand('sh:podman image exists foo') // true
 * isShellCommand('src/*.ts') // false
 * ```
 */
function isShellCommand(item: string,): boolean {
  return item.startsWith(SH_PREFIX,);
}

/**
 * Strips the `sh:` prefix from a shell command item.
 *
 * @param item - Shell command item with `sh:` prefix
 * @returns Command string without prefix
 *
 * @example
 * ```ts
 * extractCommand('sh:podman image exists foo') // 'podman image exists foo'
 * ```
 */
function extractCommand(item: string,): string {
  return item.slice(SH_PREFIX.length,);
}

//endregion Item classification

//region Timestamp parsing

/**
 * Parses a string as a timestamp.
 *
 * Supports unix epoch (seconds or milliseconds), ISO 8601 dates,
 * and the sentinel strings `Infinity` and `-Infinity`.
 * Numbers >= 1e12 are treated as milliseconds; smaller numbers as seconds.
 *
 * @param value - Trimmed stdout from a shell command
 * @returns Timestamp in milliseconds (possibly `Infinity` or `-Infinity`),
 * or `undefined` when not parseable
 *
 * @example
 * ```ts
 * parseTimestamp('1710000000') // 1710000000000 (seconds → ms)
 * parseTimestamp('Infinity') // Infinity
 * parseTimestamp('-Infinity') // -Infinity
 * parseTimestamp('') // undefined
 * ```
 */
function parseTimestamp(value: string,): number | undefined {
  if (value === '') return undefined;
  if (value === 'Infinity') return Infinity;
  if (value === '-Infinity') return -Infinity;

  const num = Number(value,);
  if (!Number.isNaN(num,) && Number.isFinite(num,)) {
    return num >= SECONDS_MS_BOUNDARY ? num : num * 1000;
  }

  const date = new Date(value,);
  if (!Number.isNaN(date.getTime(),)) {
    return date.getTime();
  }

  return undefined;
}

//endregion Timestamp parsing

//region Strategy functions

/**
 * Computes the arithmetic mean of an array of numbers.
 *
 * @param values - Non-empty array of timestamps
 * @returns Arithmetic mean
 *
 * @example
 * ```ts
 * computeMean([1, 2, 3]) // 2
 * ```
 */
function computeMean(values: readonly number[],): number {
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

/**
 * Computes the median of an array of numbers.
 *
 * For even-length arrays, returns the lower of the two middle values
 * to avoid fractional timestamps.
 *
 * @param values - Non-empty array of timestamps
 * @returns Median value
 *
 * @example
 * ```ts
 * computeMedian([3, 1, 2]) // 2
 * computeMedian([4, 1, 3, 2]) // 2
 * ```
 */
function computeMedian(values: readonly number[],): number {
  const sorted = [...values,].sort(function ascending(a, b,) { return a - b; },);
  const mid = Math.floor(sorted.length / 2,);
  // Even length: use lower middle to avoid fractional timestamps
  if (sorted.length % 2 === 0) {
    return sorted[mid - 1]!;
  }
  return sorted[mid]!;
}

/**
 * Maps strategy names to their aggregation functions.
 *
 * Empty arrays return `-Infinity` ("no information available") regardless
 * of strategy. This means empty sources = "nothing to trigger on" (fresh)
 * and empty outputs = "nothing exists yet" (stale), because
 * `-Infinity > x` is always false and `x > -Infinity` is always true.
 *
 * @example
 * ```ts
 * strategyFunctions.newest([1, 2, 3]) // 3
 * strategyFunctions.oldest([1, 2, 3]) // 1
 * strategyFunctions.mean([1, 2, 3]) // 2
 * strategyFunctions.newest([]) // -Infinity
 * ```
 */
const builtinStrategies: Readonly<Record<BuiltinTimeStrategy, (values: readonly number[],) => number>> = {
  newest: function newest(values,) { return values.length === 0 ? -Infinity : Math.max(...values,); },
  oldest: function oldest(values,) { return values.length === 0 ? -Infinity : Math.min(...values,); },
  mean: function mean(values,) { return values.length === 0 ? -Infinity : computeMean(values,); },
  median: function median(values,) { return values.length === 0 ? -Infinity : computeMedian(values,); },
};

/**
 * Runs a custom shell strategy command with timestamps piped via stdin.
 *
 * Timestamps are piped to the command as newline-separated values on stdin
 * using `printf`. The command must output a single parseable timestamp
 * on stdout. Common Unix patterns work naturally:
 * - `sort -n | head -1` for minimum (oldest)
 * - `sort -rn | head -1` for maximum (newest)
 *
 * @param command - Shell command (without `sh:` prefix)
 * @param timestamps - Resolved timestamps to pipe via stdin
 * @param verbose - Whether to log diagnostic messages
 * @returns Aggregated timestamp from command stdout
 * @throws {Error} When command fails or returns unparseable output
 *
 * @example
 * ```ts
 * await runStrategyCommand('sort -rn | head -1', [1, 2, 3], false) // 3
 * ```
 */
async function runStrategyCommand(
  command: string, timestamps: readonly number[], verbose: boolean,
): Promise<number> {
  const formattedValues = timestamps.map(function formatForShell(t,) { return String(t,); },).join(' ',);
  // Use printf to pipe timestamps (one per line) into the strategy command via stdin
  const fullCommand = `printf '%s\\n' ${formattedValues} | ${command}`;

  if (verbose) {
    console.error(`[task-depends] running strategy command: ${fullCommand}`,);
  }

  let stdout: string;
  try {
    const result = await spawn(fullCommand, { shell: true, },);
    stdout = result.stdout.trim();
  }
  catch (error) {
    throw new Error(
      outdent`
        Strategy sh: "${command}" failed with non-zero exit code
        Strategy commands must succeed and output a single timestamp
      `,
      { cause: error, },
    );
  }

  // Strategy commands receive and return millisecond timestamps.
  // Parse as raw number (no seconds/ms heuristic) or Infinity/-Infinity.
  let result: number;
  if (stdout === 'Infinity') {
    result = Infinity;
  }
  else if (stdout === '-Infinity') {
    result = -Infinity;
  }
  else {
    const num = Number(stdout,);
    if (Number.isNaN(num,)) {
      throw new Error(
        outdent`
          Strategy sh: "${command}" returned unparseable output: "${stdout}"
          Strategy commands receive millisecond timestamps and must return a millisecond timestamp, Infinity, or -Infinity
        `,
      );
    }
    result = num;
  }

  if (verbose) {
    const display = Number.isFinite(result,)
      ? new Date(result,).toISOString()
      : String(result,);
    console.error(`[task-depends] strategy sh: "${command}" → ${display}`,);
  }

  return result;
}

/**
 * Aggregates timestamps using the given strategy.
 *
 * Dispatches to a builtin function or runs a custom shell command.
 *
 * @param timestamps - Resolved timestamps to aggregate
 * @param strategy - Builtin strategy name or `sh:` command
 * @param verbose - Whether to log diagnostic messages
 * @returns Single aggregated timestamp
 *
 * @example
 * ```ts
 * await aggregateTimestamps([1, 2, 3], 'newest', false) // 3
 * ```
 */
async function aggregateTimestamps(
  timestamps: readonly number[], strategy: TimeStrategy, verbose: boolean,
): Promise<number> {
  if (strategy in builtinStrategies) {
    return builtinStrategies[strategy as BuiltinTimeStrategy](timestamps,);
  }

  if (isShellCommand(strategy,)) {
    if (timestamps.length === 0) return -Infinity;
    return runStrategyCommand(extractCommand(strategy,), timestamps, verbose,);
  }

  throw new Error(`Unknown time strategy: "${strategy}"`,);
}

//endregion Strategy functions

//region Glob resolution

/** Index of the first glob metacharacter in a pattern string */
const GLOB_META = /[*?{[]/;

/**
 * Splits a glob pattern into a base directory and a relative glob suffix.
 *
 * Everything before the first wildcard segment becomes the `cwd`;
 * the remainder becomes the pattern passed to the matcher.
 *
 * @param pattern - Glob pattern, absolute or relative
 * @returns Tuple of `[resolvedCwd, relativeGlob]`
 *
 * @example
 * ```ts
 * splitGlob('/tmp/foo/*.ts') // ['/tmp/foo', '*.ts']
 * splitGlob('src/**') // ['/abs/path/src', '**']
 * ```
 */
function splitGlob(pattern: string,): readonly [cwd: string, relativeGlob: string] {
  const metaIndex = pattern.search(GLOB_META,);

  if (metaIndex === -1) {
    return [resolve(pattern,), '',];
  }

  const staticPrefix = pattern.slice(0, metaIndex,);
  const lastSep = staticPrefix.lastIndexOf('/',);

  if (lastSep === -1) {
    return [resolve('.',), pattern,];
  }

  return [resolve(staticPrefix.slice(0, lastSep,),), pattern.slice(lastSep + 1,),];
}

/**
 * Resolves a glob pattern into file paths using `tiny-readdir-glob`.
 *
 * @param pattern - Glob pattern to expand
 * @returns Array of matched absolute file paths
 *
 * @example
 * ```ts
 * const files = await resolveGlobFiles('src/*.ts');
 * ```
 */
async function resolveGlobFiles(pattern: string,): Promise<string[]> {
  const [cwd, relativeGlob,] = splitGlob(pattern,);

  if (relativeGlob === '') {
    return [cwd,];
  }

  const { files, } = await readdirGlob(relativeGlob, { cwd, },);
  return files;
}

//endregion Glob resolution

//region Item resolution -- resolve individual items to timestamps

/**
 * Resolves a file glob to an array of file mtimes.
 *
 * When the glob matches no files, returns an empty array.
 * Empty arrays contribute no timestamps to the strategy aggregation,
 * which returns `-Infinity` ("no information") for empty input.
 *
 * @param pattern - File glob pattern
 * @param position - Whether this is a source or output item (for logging)
 * @param verbose - Whether to log diagnostic messages
 * @returns Array of file mtimes in milliseconds, or empty when no files match
 *
 * @example
 * ```ts
 * const mtimes = await resolveGlob('src/*.ts', 'source', false);
 * ```
 */
async function resolveGlob(
  pattern: string, position: 'source' | 'output', verbose: boolean,
): Promise<number[]> {
  const files = await resolveGlobFiles(pattern,);

  if (files.length === 0) {
    if (verbose) {
      console.error(`[task-depends] ${position} glob "${pattern}" matched no files`,);
    }
    return [];
  }

  const mtimes: number[] = [];
  for (const file of files) {
    const fileStat = await stat(file,);
    mtimes.push(fileStat.mtimeMs,);
  }

  if (verbose) {
    console.error(`[task-depends] ${position} glob "${pattern}" matched ${files.length} files`,);
  }

  return mtimes;
}

/**
 * Resolves a shell command to a single timestamp.
 *
 * Commands must output a parseable timestamp on stdout:
 * unix epoch (seconds or ms), ISO 8601, `Infinity`, or `-Infinity`.
 *
 * Non-zero exit codes throw an error rather than being silently
 * interpreted, preventing subtle bugs when commands fail unexpectedly.
 *
 * @param command - Shell command to execute (without `sh:` prefix)
 * @param position - Whether this is a source or output item (for error messages)
 * @param verbose - Whether to log diagnostic messages
 * @returns Resolved timestamp in milliseconds (possibly `Infinity` or `-Infinity`)
 * @throws {Error} When command exits with non-zero code or stdout is not a parseable timestamp
 *
 * @example
 * ```ts
 * // Timestamp from stdout
 * await resolveShellCommand('git log -1 --format=%ct', 'source', false)
 * // Gate pattern: explicit Infinity/-Infinity
 * await resolveShellCommand('podman image exists img && echo Infinity || echo -Infinity', 'output', false)
 * ```
 */
async function resolveShellCommand(
  command: string, position: 'source' | 'output', verbose: boolean,
): Promise<number> {
  let stdout: string;

  try {
    const result = await spawn(command, { shell: true, },);
    stdout = result.stdout.trim();
  }
  catch (error) {
    throw new Error(
      outdent`
        ${position} sh: "${command}" failed with non-zero exit code
        Commands must succeed and output a timestamp (unix epoch, ISO 8601, Infinity, or -Infinity)
        Example: sh:${command} && echo Infinity || echo -Infinity
      `,
      { cause: error, },
    );
  }

  const parsed = parseTimestamp(stdout,);
  if (parsed === undefined) {
    throw new Error(
      outdent`
        ${position} sh: "${command}" returned unparseable output: "${stdout}"
        Commands must output a timestamp (unix epoch, ISO 8601, Infinity, or -Infinity)
      `,
    );
  }

  if (verbose) {
    const display = Number.isFinite(parsed,)
      ? new Date(parsed,).toISOString()
      : String(parsed,);
    console.error(
      `[task-depends] ${position} sh: "${command}" → ${display}`,
    );
  }

  return parsed;
}

/**
 * Resolves an array of source or output items to timestamps.
 *
 * Each item is either a file glob (resolved to file mtimes) or a `sh:` prefixed
 * shell command (resolved to a single timestamp from stdout).
 *
 * @param items - Array of glob patterns and/or `sh:` commands
 * @param position - Whether these are source or output items
 * @param verbose - Whether to log diagnostic messages
 * @returns Flat array of all resolved timestamps
 *
 * @example
 * ```ts
 * const ts = await resolveItems(['src/*.ts', 'sh:git log -1 --format=%ct'], 'source', false);
 * ```
 */
async function resolveItems(
  items: readonly string[], position: 'source' | 'output', verbose: boolean,
): Promise<number[]> {
  const timestamps: number[] = [];

  for (const item of items) {
    if (isShellCommand(item,)) {
      const ts = await resolveShellCommand(extractCommand(item,), position, verbose,);
      timestamps.push(ts,);
    }
    else {
      const ts = await resolveGlob(item, position, verbose,);
      timestamps.push(...ts,);
    }
  }

  return timestamps;
}

//endregion Item resolution

//region Staleness check

/**
 * Formats a timestamp for verbose output.
 *
 * @param t - Timestamp in milliseconds (possibly `Infinity` or `-Infinity`)
 * @returns ISO 8601 string for finite values, `"Infinity"` or `"-Infinity"` for sentinels
 *
 * @example
 * ```ts
 * formatTimestamp(1710000000000) // '2024-03-09T...'
 * formatTimestamp(Infinity) // 'Infinity'
 * ```
 */
function formatTimestamp(t: number,): string {
  if (!Number.isFinite(t,)) return String(t,);
  return new Date(t,).toISOString();
}

/**
 * Checks whether sources are stale relative to outputs.
 *
 * Both sources and outputs accept file globs and `sh:` shell commands.
 * All items resolve to timestamps (including `Infinity` and `-Infinity`).
 *
 * Timestamps are aggregated per-side using the given strategies,
 * then compared: `sourceTime > outputTime` → stale.
 *
 * When no sources are provided (or all source globs match nothing),
 * source time resolves to `-Infinity` ("no information"), making the
 * comparison always false (fresh). To trigger rebuilds without file
 * sources, use an explicit `sh:` source like `-s "sh:echo Infinity"`.
 *
 * @param options - Sources, outputs, strategies, and verbose flag
 * @returns `true` when stale (command needs to run)
 * @throws {Error} When a `sh:` command fails or returns unparseable output
 *
 * @example
 * ```ts
 * const stale = await checkStaleness({
 *   sources: ['src/*.ts'],
 *   outputs: ['dist/*.js'],
 *   verbose: false,
 *   sourceTimeStrategy: 'newest',
 *   outputTimeStrategy: 'newest',
 * });
 * ```
 */
export async function checkStaleness({ sources, outputs, verbose, sourceTimeStrategy, outputTimeStrategy, }: {
  readonly sources: readonly string[];
  readonly outputs: readonly string[];
  readonly verbose: boolean;
  readonly sourceTimeStrategy: TimeStrategy;
  readonly outputTimeStrategy: TimeStrategy;
},): Promise<boolean> {
  const sourceTimestamps = await resolveItems(sources, 'source', verbose,);
  const outputTimestamps = await resolveItems(outputs, 'output', verbose,);

  const sourceTime = await aggregateTimestamps(sourceTimestamps, sourceTimeStrategy, verbose,);
  const outputTime = await aggregateTimestamps(outputTimestamps, outputTimeStrategy, verbose,);

  const stale = sourceTime > outputTime;

  if (verbose) {
    console.error(
      `[task-depends] source: ${formatTimestamp(sourceTime,)} (${sourceTimeStrategy}), output: ${formatTimestamp(outputTime,)} (${outputTimeStrategy}) → ${stale ? 'stale' : 'fresh'}`,
    );
  }

  return stale;
}

//endregion Staleness check
