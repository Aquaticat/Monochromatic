import { PATHSPEC_SEPARATOR, } from '../escape-hatch.ts';
import {
  isBranchCopyModeOption,
  isBranchListModeOption,
  isBranchNonCreateModeOption,
} from './branch-create-branch-options.ts';
import {
  isCheckoutCreateOption,
  isCheckoutNonGuessOption,
} from './branch-create-checkout-options.ts';
import { consumesNextValue, } from './branch-create-dispatch.ts';
import { isPositionalToken, } from './branch-create-shared.ts';
import {
  BRANCH_WORKTREE_ESCAPE_HATCH,
  NO_IMPLICIT_CREATION_TARGET,
  type BranchCreationRegion,
  type BranchCreationSubcommand,
} from './branch-create-types.ts';
import {
  isSwitchCreateOption,
  isSwitchNonGuessOption,
} from './branch-create-switch-options.ts';

export { stripBranchCreationEscapeHatch, } from './branch-create-strip.ts';
export {
  BRANCH_WORKTREE_ESCAPE_HATCH,
  NO_IMPLICIT_CREATION_TARGET,
  type BranchCreationRegion,
  type BranchCreationSubcommand,
} from './branch-create-types.ts';

//region Branch-creation scan helpers

/**
 * Accumulator mutated inside one linear argv scan.
 */
type BranchCreationScan = {
  /**
   * Whether argv explicitly creates, resets, or copies a branch.
   */
  createsBranch: boolean;
  /**
   * Whether wrapper escape hatch appears in flag position.
   */
  hasEscapeHatch: boolean;
  /**
   * Whether git-branch is listing or inspecting refs.
   */
  isBranchListMode: boolean;
  /**
   * Whether git-branch selected a non-create mutation mode.
   */
  isBranchNonCreateMode: boolean;
  /**
   * Whether checkout/switch cannot do implicit remote branch guessing.
   */
  disablesImplicitGuess: boolean;
  /**
   * Positional tokens observed before a pathspec separator.
   */
  positionals: string[];
};

/**
 * Creates empty branch-creation scan accumulator.
 *
 * @returns Empty scan state.
 */
function createScan(): BranchCreationScan {
  return {
    createsBranch: false,
    hasEscapeHatch: false,
    isBranchListMode: false,
    isBranchNonCreateMode: false,
    disablesImplicitGuess: false,
    positionals: [],
  };
}

//endregion Branch-creation scan helpers

//region Branch-creation parser

/**
 * Parses guarded subcommand argv for explicit and implicit branch creation.
 * Recognises the {@link BRANCH_WORKTREE_ESCAPE_HATCH} flag and stops scanning
 * options at {@link PATHSPEC_SEPARATOR}; per subcommand, delegates to the
 * branch-mode predicates ({@link isBranchCopyModeOption},
 * {@link isBranchListModeOption}, {@link isBranchNonCreateModeOption}), the
 * checkout-mode predicates ({@link isCheckoutCreateOption},
 * {@link isCheckoutNonGuessOption}), or the switch-mode predicates
 * ({@link isSwitchCreateOption}, {@link isSwitchNonGuessOption}); skips
 * value-consuming tokens via {@link consumesNextValue} and collects the rest
 * with {@link isPositionalToken}.
 *
 * @param subcommand - Guarded git subcommand.
 *
 * @param postSubcommandArgs - Arguments strictly after subcommand.
 *
 * @returns Branch-creation facts for policy enforcement.
 *
 * @example
 * ```ts
 * parseBranchCreationRegion({ subcommand: 'switch', postSubcommandArgs: ['-c', 'topic'] });
 * // createsBranch = true
 * ```
 */
export function parseBranchCreationRegion({
  subcommand,
  postSubcommandArgs,
}: {
  readonly subcommand: BranchCreationSubcommand;
  readonly postSubcommandArgs: readonly string[];
},): BranchCreationRegion {
  /**
   * Accumulated facts from one linear pass over argv.
   */
  const scan = createScan();

  for (let index = 0; index < postSubcommandArgs.length; index += 1) {
    /**
     * Current argv token under inspection.
     */
    const arg = postSubcommandArgs[index];

    if (arg === undefined)
      continue;

    if (arg === PATHSPEC_SEPARATOR) {
      scan.disablesImplicitGuess = true;
      break;
    }

    if (arg === BRANCH_WORKTREE_ESCAPE_HATCH) {
      scan.hasEscapeHatch = true;
    }
    else if (subcommand === 'branch') {
      scan.createsBranch ||= isBranchCopyModeOption(arg,);
      scan.isBranchListMode ||= isBranchListModeOption(arg,);
      scan.isBranchNonCreateMode ||= isBranchNonCreateModeOption(arg,);
    }
    else if (subcommand === 'checkout') {
      scan.createsBranch ||= isCheckoutCreateOption(arg,);
      scan.disablesImplicitGuess ||= isCheckoutNonGuessOption(arg,);
    }
    else {
      scan.createsBranch ||= isSwitchCreateOption(arg,);
      scan.disablesImplicitGuess ||= isSwitchNonGuessOption(arg,);
    }

    if (consumesNextValue({
      subcommand,
      arg,
    },)) {
      index += 1;
      continue;
    }

    if (isPositionalToken(arg,)) {
      scan
        .positionals
        .push(arg,);
    }
  }

  if (subcommand === 'branch') {
    /**
     * Positional arguments after branch-mode options consumed their values.
     */
    const { positionals, } = scan;
    /**
     * Number of positional arguments after branch-mode options consumed their values.
     */
    const positionalCount = positionals.length;
    /**
     * Whether git-branch positional arguments name new branches rather than list patterns or existing refs.
     */
    const positionalsCreateBranch = (positionalCount > 0)
      && (!scan.isBranchListMode)
      && (!scan.isBranchNonCreateMode);

    return {
      createsBranch: scan.createsBranch || positionalsCreateBranch,
      hasEscapeHatch: scan.hasEscapeHatch,
      implicitCreationTarget: NO_IMPLICIT_CREATION_TARGET,
    };
  }

  /**
   * Positional branch name that switch/checkout may turn into a local branch by guessing one remote.
   */
  const [candidateTarget, secondTarget,] = scan.positionals;

  /**
   * Whether no implicit branch creation target remains to check against remotes.
   */
  const hasNoImplicitTarget = scan.createsBranch
    || scan.disablesImplicitGuess
    || (candidateTarget === undefined)
    || (secondTarget !== undefined);

  if (hasNoImplicitTarget) {
    return {
      createsBranch: scan.createsBranch,
      hasEscapeHatch: scan.hasEscapeHatch,
      implicitCreationTarget: NO_IMPLICIT_CREATION_TARGET,
    };
  }

  return {
    createsBranch: scan.createsBranch,
    hasEscapeHatch: scan.hasEscapeHatch,
    implicitCreationTarget: candidateTarget,
  };
}

//endregion Branch-creation parser
