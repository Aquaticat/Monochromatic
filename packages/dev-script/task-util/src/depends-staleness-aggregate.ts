/**
 * Strategy aggregation for task-depends staleness detection.
 *
 * Dispatches timestamp arrays to builtin strategy functions or custom
 * shell commands, producing a single representative timestamp per side.
 *
 * @module
 */

import { outdent, } from '@cspotcode/outdent';
import spawn from 'nano-spawn';

import {
  builtinStrategies,
  type BuiltinTimeStrategy,
  type TimeStrategy,
} from './depends-strategy.ts';

//region Shell strategy execution

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
  command: string,
  timestamps: readonly number[],
  verbose: boolean,
): Promise<number> {
  const formattedValues = timestamps.map(String,).join(' ',);
  // Use printf to pipe timestamps (one per line) into the strategy command via stdin
  const fullCommand = `printf '%s\\n' ${formattedValues} | ${command}`;

  if (verbose)
    console.error(`[task-depends] running strategy command: ${fullCommand}`,);

  /** Raw stdout from the command */
  let stdout = '';
  try {
    const result = await spawn(
      fullCommand,
      { shell: true, },
    );
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
  if (stdout === 'Infinity')
    result = Infinity;
  else if (stdout === '-Infinity')
    result = -Infinity;
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

//endregion Shell strategy execution

//region Aggregation dispatch

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
export async function aggregateTimestamps(
  timestamps: readonly number[],
  strategy: TimeStrategy,
  verbose: boolean,
): Promise<number> {
  if (strategy in builtinStrategies) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 'in' check above narrows strategy to BuiltinTimeStrategy
    return builtinStrategies[strategy as BuiltinTimeStrategy](timestamps,);
  }

  /** Prefix that identifies a shell command strategy */
  const shPrefix = 'sh:';
  if (strategy.startsWith(shPrefix,)) {
    if (timestamps.length === 0)
      return -Infinity;
    return await runStrategyCommand(
      strategy.slice(shPrefix.length,),
      timestamps,
      verbose,
    );
  }

  throw new Error(`Unknown time strategy: "${strategy}"`,);
}

//endregion Aggregation dispatch
