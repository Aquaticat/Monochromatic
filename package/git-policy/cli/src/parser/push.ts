import {
  type ArgvSpec,
  parseArgv,
} from './argv.ts';

//region Push post-subcommand region parser

/**
 * Declared option surface of the post-`push` argv region.
 *
 * Models the user-toggled atomicity flags so the wrapper can inject
 * `--atomic` only when the caller has not chosen explicitly. Pathspecs and
 * other tokens are captured generically; the wrapper does not transform
 * them.
 */
const pushRegionSpec: ArgvSpec = {
  flags: {
    atomicFlags: { names: [
      '--atomic',
      '--no-atomic',
    ], },
    dryRunFlags: { names: [
      '-n',
      '--dry-run',
    ], },
    noDryRunFlags: { names: ['--no-dry-run',], },
  },
  valueOptions: {},
};

//endregion Push post-subcommand region parser

//region Push region facts

/**
 * Facts about the post-`push` argv region used by atomic-push policy.
 */
export type PushRegion = {
  /**
   * True when caller has chosen atomic or non-atomic mode explicitly.
   */
  readonly hasAtomicChoice: boolean;
  /**
   * Whether final exact dry-run toggle requests no remote update.
   */
  readonly isDryRun: boolean;
};

/**
 * Parses the post-`push` argv region into a structured fact set used by the
 * atomic-push rule. The rule only needs to know whether the caller already
 * made an explicit choice between atomic and non-atomic.
 *
 * @param postSubcommandArgs - Arguments strictly after `push` subcommand.
 *
 * @returns Fact record consumed by atomic-push policy.
 *
 * @example
 * ```ts
 * parsePushRegion(['origin', 'main']).hasAtomicChoice;
 * // => false (no explicit choice; wrapper will inject --atomic)
 * ```
 */
export function parsePushRegion(
  postSubcommandArgs: readonly string[],
): PushRegion {
  /**
   * Parsed facts over the post-subcommand region.
   */
  const { flagCounts, } = parseArgv({
    args: postSubcommandArgs,
    spec: pushRegionSpec,
  },);
  /**
   * Final exact dry-run toggle, matching Git's last-option-wins behavior.
   */
  const isDryRun = postSubcommandArgs.reduce(
    function applyDryRunToggle(
    enabled,
    arg,
  ) {
    if ((arg === '-n') || (arg === '--dry-run'))
      return true;
    if (arg === '--no-dry-run')
      return false;
    return enabled;
  },
    false,
  );
  return {
    hasAtomicChoice: (flagCounts.atomicFlags ?? 0) > 0,
    isDryRun,
  };
}

//endregion Push region facts
