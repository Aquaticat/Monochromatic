//region Branch-creation public facts

/**
 * Wrapper-only flag that suppresses worktree-first branch creation enforcement
 * for one invocation.
 */
export const BRANCH_WORKTREE_ESCAPE_HATCH = '--no-enforce-worktree-branch';

/**
 * Git subcommands whose branch-creation modes are guarded by cli-git.
 */
export type BranchCreationSubcommand = 'branch' | 'checkout' | 'switch';

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
   * Branch name whose remote-tracking guess would make git create a local branch.
   */
  readonly implicitCreationTarget: string | undefined;
};

//endregion Branch-creation public facts
