/**
 * CLI argument parsing for the distribution wrapper.
 *
 * @example
 * ```ts
 * parseDistributionArgs({ argv: ['--dry-run'] });
 * ```
 *
 * @packageDocumentation
 */

/**
 * Parsed CLI arguments for this distribution wrapper.
 *
 * @example
 * ```ts
 * const options: DistributionOptions = { dryRun: true, selectedTargetKeys: [] };
 * ```
 */
export type DistributionOptions = {
  readonly dryRun: boolean;
  readonly selectedTargetKeys: readonly string[];
};

/**
 * Internal immutable state for CLI argument parsing.
 *
 * @example
 * ```ts
 * const state: DistributionArgState = {
 *   dryRun: false,
 *   expectTargetValue: false,
 *   selectedTargetKeys: [],
 * };
 * ```
 */
type DistributionArgState = DistributionOptions & {
  readonly expectTargetValue: boolean;
};

/**
 * Parses distribution CLI arguments.
 *
 * @param argv - Argument vector after node and script path.
 *
 * @returns Dry-run flag plus optional target-key filters.
 *
 * @example
 * ```ts
 * parseDistributionArgs({ argv: ['--dry-run', '--target', 'linux-x64'] });
 * ```
 */
export function parseDistributionArgs(
  { argv, }: { readonly argv: readonly string[]; },
): DistributionOptions {
  /**
   * Parsed argument state after scanning every token.
   */
  const state = argv.reduce(function reduceDistributionArgState(
    currentState: DistributionArgState,
    token: string,
  ): DistributionArgState {
    if (currentState.expectTargetValue)
      return {
        dryRun: currentState.dryRun,
        expectTargetValue: false,
        selectedTargetKeys: [
          ...currentState.selectedTargetKeys,
          token,
        ],
      };

    if (token === '--dry-run')
      return {
        ...currentState,
        dryRun: true,
      };

    if (token === '--target')
      return {
        ...currentState,
        expectTargetValue: true,
      };

    throw new Error(`Unknown distribution argument: ${String(token,)}`,
    );
  }, {
    dryRun: false,
    expectTargetValue: false,
    selectedTargetKeys: [],
  },);

  if (state.expectTargetValue)
    throw new Error('--target requires a target key.',);

  return {
    dryRun: state.dryRun,
    selectedTargetKeys: state.selectedTargetKeys,
  };
}
