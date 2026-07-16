import {
  type ArgvSpec,
  parseArgv,
} from './argv.ts';

//region Status pre-subcommand and post-subcommand parsers

/**
 * Config key that callers can set via `-c` to override the wrapper's status
 * advice. Compared case-insensitively because git treats section and key
 * names case-insensitively.
 */
const ADVICE_KEY = 'advice.statushints';

/**
 * Config key prefix matching the valued form `-c advice.statusHints=<value>`.
 */
const ADVICE_KEY_PREFIX = `${ADVICE_KEY}=`;

/**
 * Pre-subcommand declared surface scoped to the facts the status-hints rule needs.
 */
const statusPreSpec: ArgvSpec = {
  flags: {},
  valueOptions: { configValues: { names: ['-c',], }, },
};

/**
 * Post-subcommand declared surface for `git status` machine-readable detection.
 */
const statusPostSpec: ArgvSpec = {
  flags: {
    porcelainFlags: { names: [
      '--porcelain',
      '-z',
    ], },
    shortFlags: { names: [
      '-s',
      '--short',
    ], },
  },
  valueOptions: {},
};

//endregion Status pre-subcommand and post-subcommand parsers

//region Status region facts

/**
 * Facts about the pre-`status` argv region used by status-hints policy.
 */
export type StatusPreRegion = {
  /**
   * True when caller already configured `advice.statusHints` via `-c`.
   */
  readonly hasStatusHintsOverride: boolean;
};

/**
 * Facts about the post-`status` argv region used by status-hints policy.
 */
export type StatusPostRegion = {
  /**
   * True when the caller asked git for a machine-readable status format.
   */
  readonly isMachineReadable: boolean;
};

/**
 * Detects whether caller already configured `advice.statusHints` via a
 * pre-subcommand `-c <key>=<value>` pair.
 *
 * @param preSubcommandArgs - Pre-subcommand region from the wrapper invocation.
 *
 * @returns Fact record consumed by status-hints policy.
 *
 * @example
 * ```ts
 * parseStatusPreRegion(['-c', 'advice.statusHints=true']).hasStatusHintsOverride;
 * // => true
 * ```
 */
export function parseStatusPreRegion(
  preSubcommandArgs: readonly string[],
): StatusPreRegion {
  /**
   * Parsed facts over the pre-subcommand region.
   */
  const { optionValues, } = parseArgv({
    args: preSubcommandArgs,
    spec: statusPreSpec,
  },);

  return {
    hasStatusHintsOverride: (optionValues.configValues ?? [])
      .some(function isAdviceKey(configValue: string,) {
      /**
       * Config token lowered for git's case-insensitive key matching.
       */
      const lowered = configValue.toLowerCase();
      // The bare form `-c advice.statusHints` (no `=`) is git's boolean-true
      // spelling and is just as much an explicit user choice as the valued form.
      return lowered.startsWith(ADVICE_KEY_PREFIX,)
        || (lowered === ADVICE_KEY);
    },),
  };
}

/**
 * Detects whether caller asked git for a machine-readable status output.
 *
 * @param postSubcommandArgs - Arguments strictly after `status` subcommand.
 *
 * @returns Fact record consumed by entry-point note suppression.
 *
 * @example
 * ```ts
 * parseStatusPostRegion(['--porcelain']).isMachineReadable;
 * // => true
 *
 * parseStatusPostRegion(['--porcelain=v2']).isMachineReadable;
 * // => true
 * ```
 */
export function parseStatusPostRegion(
  postSubcommandArgs: readonly string[],
): StatusPostRegion {
  /**
   * True when token uses joined `--porcelain=` form.
   */
  const hasPorcelainJoined = postSubcommandArgs.some(function isPorcelainJoined(arg,) {
    return arg.startsWith('--porcelain=',);
  },);

  if (hasPorcelainJoined)
    return { isMachineReadable: true, };

  /**
   * Parsed facts over the post-subcommand region.
   */
  const { flagCounts, } = parseArgv({
    args: postSubcommandArgs,
    spec: statusPostSpec,
  },);

  /**
   * Sum of machine-readable status flag occurrences (`--porcelain`/`-z` + `-s`/`--short`).
   */
  const machineReadableCount = (flagCounts.porcelainFlags ?? 0)
    + (flagCounts.shortFlags ?? 0);

  return {
    isMachineReadable: machineReadableCount > 0,
  };
}

//endregion Status region facts
