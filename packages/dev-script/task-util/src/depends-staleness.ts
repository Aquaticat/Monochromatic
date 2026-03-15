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

import { outdent, } from '@cspotcode/outdent';
import spawn from 'nano-spawn';

import { resolveItems, } from './depends-resolve.ts';
import { builtinStrategies, type BuiltinTimeStrategy, type TimeStrategy, } from './depends-strategy.ts';

export type { BuiltinTimeStrategy, TimeStrategy, } from './depends-strategy.ts';


//region Strategy functions

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
 *
 * @param timestamps - Resolved timestamps to pipe via stdin
 *
 * @param verbose - Whether to log diagnostic messages
 *
 * @returns Aggregated timestamp from command stdout
 *
 * @throws When command fails or returns unparseable output
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

  /** Raw stdout from the command */
  let stdout = '';
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
  /** Aggregated timestamp parsed from stdout */
  let result = 0;
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
 *
 * @param strategy - Builtin strategy name or `sh:` command
 *
 * @param verbose - Whether to log diagnostic messages
 *
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 'in' check above narrows strategy to BuiltinTimeStrategy
    return builtinStrategies[strategy as BuiltinTimeStrategy](timestamps,);
  }

  /** Prefix that identifies a shell command strategy */
  const shPrefix = 'sh:';
  if (strategy.startsWith(shPrefix,)) {
    if (timestamps.length === 0) return -Infinity;
    return runStrategyCommand(strategy.slice(shPrefix.length,), timestamps, verbose,);
  }

  throw new Error(`Unknown time strategy: "${strategy}"`,);
}

//endregion Strategy functions

//region Staleness check

/**
 * Formats a timestamp for verbose output.
 *
 * @param t - Timestamp in milliseconds (possibly `Infinity` or `-Infinity`)
 *
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
 * @param sources - File globs or `sh:` commands for source timestamps
 *
 * @param outputs - File globs or `sh:` commands for output timestamps
 *
 * @param verbose - Whether to log diagnostic messages
 *
 * @param sourceTimeStrategy - Strategy for aggregating source timestamps
 *
 * @param outputTimeStrategy - Strategy for aggregating output timestamps
 *
 * @returns `true` when stale (command needs to run)
 *
 * @throws When a `sh:` command fails or returns unparseable output
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
