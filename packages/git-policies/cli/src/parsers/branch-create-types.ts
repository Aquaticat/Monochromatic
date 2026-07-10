//region Branch-creation public facts

/**
 * Wrapper-only flag that suppresses worktree-first branch creation enforcement
 * for one invocation.
 */
export const BRANCH_WORKTREE_ESCAPE_HATCH = '--no-enforce-worktree-branch';

/**
 * Sentinel used when argv cannot create a branch through remote guessing.
 */
export const NO_IMPLICIT_CREATION_TARGET: unique symbol = Symbol(
  'argv scan found explicit mode or non-single target before remote guessing',
);

/**
 * Git subcommands whose branch-creation modes are guarded by cli-git.
 */
export type BranchCreationSubcommand = 'branch' | 'checkout' | 'switch';

/**
 * Branch name to probe, or sentinel when no implicit creation probe is needed.
 */
export type ImplicitCreationTarget = string | typeof NO_IMPLICIT_CREATION_TARGET;

/**
 * Facts extracted from one guarded subcommand's post-subcommand argv.
 */
export type BranchCreationRegion = {
  /**
   * Whether argv explicitly asks git to create, reset, or copy a branch ref.
   */
  readonly createsBranch: boolean;
  /**
   * Whether wrapper-only escape hatch appears as a real flag.
   */
  readonly hasEscapeHatch: boolean;
  /**
   * Branch name whose remote-tracking guess would make git create a local branch, or sentinel.
   */
  readonly implicitCreationTarget: ImplicitCreationTarget;
};

//endregion Branch-creation public facts
