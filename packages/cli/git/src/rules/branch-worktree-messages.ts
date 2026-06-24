import { BRANCH_WORKTREE_ESCAPE_HATCH, type BranchCreationSubcommand, } from '../parsers/branch-create.ts';

//region Branch worktree diagnostics

/**
 * Builds human-facing rejection message for branch creation in current worktree.
 *
 * @param subcommand - Git subcommand being rejected.
 *
 * @param target - Branch name being implicitly created, when known.
 *
 * @returns cli-git diagnostic text.
 */
export function branchCreationMessage({
  subcommand,
  target,
}: {
  readonly subcommand: BranchCreationSubcommand;
  readonly target: string | undefined;
},): string {
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
