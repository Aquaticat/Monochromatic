import {
  BRANCH_WORKTREE_ESCAPE_HATCH,
  type BranchCreationSubcommand,
} from '../parser/branch-create.ts';

//region Branch worktree diagnostics

/**
 * Options for building branch-creation rejection messages.
 */
type BranchCreationMessageOptions = {
  /**
   * Git subcommand being rejected.
   */
  readonly subcommand: BranchCreationSubcommand;
  /**
   * Branch name being implicitly created, when known.
   */
  readonly target?: string;
};

/**
 * Builds human-facing rejection message for branch creation in current
 * worktree, naming {@link BRANCH_WORKTREE_ESCAPE_HATCH} as the bypass.
 *
 * @param subcommand - Git subcommand being rejected.
 *
 * @param target - Branch name being implicitly created, when known.
 *
 * @returns cli-git diagnostic text.
 *
 * @example
 * ```ts
 * branchCreationMessage({ subcommand: 'switch', target: 'topic' });
 * // => message that recommends git worktree add -b
 * ```
 */
export function branchCreationMessage({
  subcommand,
  target,
}: BranchCreationMessageOptions,): string {
  /**
   * Optional target clause for implicit remote-tracking branch creation diagnostics.
   */
  const targetClause = target === undefined
    ? ''
    : ` for ${target}`;

  return `cli-git: git ${subcommand}${targetClause} branch creation is rejected in the current worktree. `
    + 'Use `git worktree add -b <branch> <path> [<start-point>]` so new branch work starts in its own checkout, '
    + `or pass ${BRANCH_WORKTREE_ESCAPE_HATCH} to bypass for this invocation.`;
}

//endregion Branch worktree diagnostics
