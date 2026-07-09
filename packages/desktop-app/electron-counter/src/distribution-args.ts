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
 * Internal mutable accumulator for CLI argument parsing.
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
type DistributionArgState = {
  dryRun: boolean;
  expectTargetValue: boolean;
  selectedTargetKeys: string[];
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
   * Parsed argument state mutated by the single CLI scan.
   */
  const state: DistributionArgState = {
    dryRun: false,
    expectTargetValue: false,
    selectedTargetKeys: [],
  };

  argv.forEach(function readDistributionArg(token,): void {
    if (state.expectTargetValue) {
      state.expectTargetValue = false;
      state.selectedTargetKeys
        .push(token,);
      return;
    }

    if (token === '--dry-run') {
      state.dryRun = true;
      return;
    }

    if (token === '--target') {
      state.expectTargetValue = true;
      return;
    }

    throw new Error(`Unknown distribution argument: ${token}`,
    );
  },);

  if (state.expectTargetValue)
    throw new Error('--target requires a target key.',);

  return {
    dryRun: state.dryRun,
    selectedTargetKeys: state.selectedTargetKeys,
  };
}
