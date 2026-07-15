export {
  PATHSPEC_SEPARATOR,
  WORKTREE_ENFORCEMENT_ESCAPE_HATCH,
} from '../escape-hatch.ts';

//region Linked worktree rule constants

/**
 * Git stash subcommand guarded by linked-worktree policy.
 */
export const STASH_SUBCOMMAND = 'stash';

/**
 * Git clean subcommand guarded by linked-worktree policy when it can delete files.
 */
export const CLEAN_SUBCOMMAND = 'clean';

/**
 * Git reset subcommand guarded by linked-worktree policy for worktree-updating modes.
 */
export const RESET_SUBCOMMAND = 'reset';

/**
 * Commands with linked-worktree-only policy.
 */
export type GuardedCommand =
  | typeof STASH_SUBCOMMAND
  | typeof CLEAN_SUBCOMMAND
  | typeof RESET_SUBCOMMAND;

//endregion Linked worktree rule constants
