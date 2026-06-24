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
  type BranchCreationRegion,
  type BranchCreationSubcommand,
} from './branch-create-types.ts';

//region Branch-creation scan helpers

/**
 * Mutable accumulator used only inside one linear argv scan.
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

/**
 * Applies subcommand-specific facts from one non-value argv token.
 *
 * @param scan - Mutable scan accumulator for current argv.
 *
 * @param subcommand - Guarded subcommand whose grammar applies.
 *
 * @param arg - Current non-value argv token.
 *
 * @returns Nothing; scan is updated in place for a short-lived parser accumulator.
 */
function applyTokenFacts({
  scan,
  subcommand,
  arg,
}: {
  readonly scan: BranchCreationScan;
  readonly subcommand: BranchCreationSubcommand;
  readonly arg: string;
},): void {
  if (arg === BRANCH_WORKTREE_ESCAPE_HATCH) {
    scan.hasEscapeHatch = true;
    return;
  }

  if (subcommand === 'branch') {
    scan.createsBranch = scan.createsBranch || isBranchCopyModeOption(arg,);
    scan.isBranchListMode = scan.isBranchListMode || isBranchListModeOption(arg,);
    scan.isBranchNonCreateMode = scan.isBranchNonCreateMode || isBranchNonCreateModeOption(arg,);
    return;
  }

  if (subcommand === 'checkout') {
    scan.createsBranch = scan.createsBranch || isCheckoutCreateOption(arg,);
    scan.disablesImplicitGuess = scan.disablesImplicitGuess || isCheckoutNonGuessOption(arg,);
    return;
  }

  scan.createsBranch = scan.createsBranch || isSwitchCreateOption(arg,);
  scan.disablesImplicitGuess = scan.disablesImplicitGuess || isSwitchNonGuessOption(arg,);
}

//endregion Branch-creation scan helpers

//region Branch-creation parser

/**
 * Parses guarded subcommand argv for explicit and implicit branch creation.
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

    applyTokenFacts({ scan, subcommand, arg, },);

    if (consumesNextValue({ subcommand, arg, })) {
      index += 1;
      continue;
    }

    if (isPositionalToken(arg,))
      scan.positionals.push(arg,);
  }

  if (subcommand === 'branch') {
    return {
      createsBranch: scan.createsBranch
        || (scan.positionals.length > 0
          && !scan.isBranchListMode
          && !scan.isBranchNonCreateMode),
      hasEscapeHatch: scan.hasEscapeHatch,
      implicitCreationTarget: undefined,
    };
  }

  /**
   * Positional branch name that switch/checkout may turn into a local branch by guessing one remote.
   */
  const [candidateTarget, secondTarget,] = scan.positionals;
  /**
   * Candidate is safe to query only when exactly one positional branch-like target remains.
   */
  const implicitCreationTarget = (!scan.createsBranch)
    && (!scan.disablesImplicitGuess)
    && (candidateTarget !== undefined)
    && (secondTarget === undefined)
    ? candidateTarget
    : undefined;

  return {
    createsBranch: scan.createsBranch,
    hasEscapeHatch: scan.hasEscapeHatch,
    implicitCreationTarget,
  };
}

//endregion Branch-creation parser
