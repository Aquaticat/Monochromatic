import {
  CLEAN_SUBCOMMAND,
  type GuardedCommand,
  RESET_SUBCOMMAND,
  STASH_SUBCOMMAND,
} from './linked-worktree-constants.ts';

//region Linked worktree diagnostics

/**
 * Options for message construction for rejected guarded invocations.
 */
type CommandMessageOptions = {
  /**
   * Guarded git subcommand.
   */
  readonly command: GuardedCommand;
};

/**
 * Throws for an exhaustively impossible guarded command.
 *
 * @param command - Command value narrowed to `never` by callers.
 *
 * @throws Error unconditionally for impossible runtime input.
 *
 * @example
 * ```ts
 * if (false) unhandledGuardedCommand('stash' as never);
 * ```
 */
function unhandledGuardedCommand(command: never,): never {
  throw new Error('cli-git: unhandled linked-worktree command.', { cause: command, },);
}

/**
 * Builds outside-worktree diagnostic for guarded command.
 *
 * @param command - Guarded git subcommand.
 *
 * @returns Error message for outside-worktree rejection.
 *
 * @example
 * ```ts
 * outsideWorktreeMessage({ command: 'stash' });
 * // => 'cli-git: git stash requires ...'
 * ```
 */
export function outsideWorktreeMessage({ command, }: CommandMessageOptions,): string {
  if (command === STASH_SUBCOMMAND) {
    return 'cli-git: git stash requires the effective working directory to be inside a linked git worktree. '
      + 'Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. '
      + 'cd to a linked worktree root or pass -C <linked-worktree-root> before stash.';
  }

  if (command === CLEAN_SUBCOMMAND) {
    return 'cli-git: state-changing git clean requires the effective working directory to be inside a linked git worktree. '
      + 'Refusing to run from outside a worktree because git clean can delete filesystem state outside what the caller expected. '
      + 'cd to a linked worktree root or pass -C <linked-worktree-root> before clean, or use --dry-run to inspect.';
  }

  if (command === RESET_SUBCOMMAND) {
    return 'cli-git: destructive git reset modes require the effective working directory to be inside a linked git worktree. '
      + 'Refusing to run from outside a worktree because git reset --hard, --merge, and --keep can rewrite tracked files outside what the caller expected. '
      + 'cd to a linked worktree root or pass -C <linked-worktree-root> before reset.';
  }

  return unhandledGuardedCommand(command,);
}

/**
 * Builds main-worktree diagnostic for guarded command.
 *
 * @param command - Guarded git subcommand.
 *
 * @returns Error message for main-worktree rejection.
 *
 * @example
 * ```ts
 * mainWorktreeMessage({ command: 'stash' });
 * // => 'cli-git: git stash is rejected ...'
 * ```
 */
export function mainWorktreeMessage({ command, }: CommandMessageOptions,): string {
  if (command === STASH_SUBCOMMAND) {
    return 'cli-git: git stash is rejected in the main git worktree. '
      + 'Refusing to run because git stash can revert primary checkout filesystem state outside what the caller expected. '
      + 'Use a linked worktree for stash operations.';
  }

  if (command === CLEAN_SUBCOMMAND) {
    return 'cli-git: state-changing git clean is rejected in the main git worktree. '
      + 'Refusing to run because git clean can delete primary checkout filesystem state outside what the caller expected. '
      + 'Use a linked worktree for state-changing clean operations, or use --dry-run to inspect.';
  }

  if (command === RESET_SUBCOMMAND) {
    return 'cli-git: destructive git reset modes are rejected in the main git worktree. '
      + 'Refusing to run because git reset --hard, --merge, and --keep can rewrite primary checkout files outside what the caller expected. '
      + 'Use a linked worktree for destructive reset operations.';
  }

  return unhandledGuardedCommand(command,);
}

//endregion Linked worktree diagnostics
