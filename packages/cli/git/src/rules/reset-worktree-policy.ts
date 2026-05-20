import { PATHSPEC_SEPARATOR, } from './linked-worktree-constants.ts';

//region Git reset worktree-change policy

/** Reset modes that update worktree files according to git-reset documentation. */
const DESTRUCTIVE_RESET_MODES: ReadonlySet<string> = new Set([
  '--hard',
  '--merge',
  '--keep',
],);

/**
 * Recursively detects destructive reset modes before pathspec separator.
 *
 * @param postSubcommandArgs - Arguments strictly after `reset` subcommand.
 *
 * @returns `true` when `--hard`, `--merge`, or `--keep` appears before `--`.
 *
 * @example
 * ```ts
 * resetChangesWorktree(['--hard', 'HEAD~1']);
 * // => true
 * ```
 */
export function resetChangesWorktree(postSubcommandArgs: readonly string[],): boolean {
  /** Current reset argv token. */
  const [arg,] = postSubcommandArgs;

  if ((arg === undefined) || (arg === PATHSPEC_SEPARATOR))
    return false;

  if (DESTRUCTIVE_RESET_MODES.has(arg,))
    return true;

  return resetChangesWorktree(postSubcommandArgs.slice(1,),);
}

//endregion Git reset worktree-change policy
