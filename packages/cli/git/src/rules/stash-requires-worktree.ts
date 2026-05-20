import nanoSpawn, { SubprocessError, } from 'nano-spawn';

import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { resolveGit, } from '../resolve-git.ts';

//region Stash worktree enforcement

/** Git subcommand guarded by this rule. */
const STASH_SUBCOMMAND = 'stash';

/** Diagnostic emitted when stash is requested outside real git worktree. */
const NOT_IN_WORKTREE_MESSAGE =
  'cli-git: git stash requires the effective working directory to be inside a git worktree. '
  + 'Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. '
  + 'cd to the repository worktree root or pass -C <worktree-root> before stash.';

/** Options for checking whether effective cwd is inside Git worktree. */
type IsInsideGitWorktreeOptions = {
  /** Effective cwd after applying pre-subcommand `-C` chaining. */
  readonly effectiveCwd: string;
};

/**
 * Asks real git whether effective cwd is inside a worktree, ignoring explicit
 * `--git-dir` / `--work-tree` options from original stash invocation so the
 * guard stays anchored to command launch context.
 *
 * @param effectiveCwd - Effective cwd to query through real git.
 *
 * @returns `true` when real git reports cwd is inside worktree.
 *
 * @example
 * ```ts
 * await isInsideGitWorktree({ effectiveCwd: '/repo', });
 * // => true when /repo is inside a real Git worktree
 * ```
 */
async function isInsideGitWorktree({
  effectiveCwd,
}: IsInsideGitWorktreeOptions,): Promise<boolean> {
  /** Absolute path to real git binary used for read-only worktree query. */
  const gitPath = await resolveGit();

  try {
    /** Result of read-only Git worktree membership query. */
    const result = await nanoSpawn(
      gitPath,
      [
        '-C',
        effectiveCwd,
        'rev-parse',
        '--is-inside-work-tree',
      ],
    );

    return result.stdout === 'true';
  }
  catch (error) {
    if (error instanceof SubprocessError)
      return false;
    throw error;
  }
}

/**
 * Rejects `git stash` when the effective working directory is not inside a
 * git worktree. `git stash` can update tracked files in the selected worktree,
 * so allowing `--git-dir` / `--work-tree` forms from unrelated directories can
 * revert filesystem state outside what the caller expects from current cwd.
 *
 * @param args - Git argv to inspect after wrapper invocation.
 *
 * @returns Original argv when command is not `stash` or cwd is inside worktree.
 *
 * @throws When `stash` is requested outside real git worktree.
 *
 * @example
 * ```ts
 * await stashRequiresWorktree(['-C', '/repo', 'stash']);
 * // passes when real git reports /repo is inside worktree
 *
 * await stashRequiresWorktree(['-C', '/tmp', 'stash']);
 * // throws when /tmp is not inside worktree
 * ```
 */
export async function stashRequiresWorktree(
  args: readonly string[],
): Promise<readonly string[]> {
  /** Effective cwd and subcommand index after walking pre-subcommand `-C` chaining. */
  const {
    effectiveCwd,
    subcommandIndex,
  } = parseGlobalOptions(args,);
  /** Subcommand at the located index; `undefined` when args have no subcommand. */
  const subcommand = args[subcommandIndex];

  if (subcommand !== STASH_SUBCOMMAND)
    return args;

  /** Tagged logger for the stash-requires-worktree rule. */
  const rl = tagged({
    tag: stashRequiresWorktree.name,
    l,
  },);

  rl.debug(`effective cwd: ${effectiveCwd}`,);

  if (!await isInsideGitWorktree({ effectiveCwd, },))
    throw new Error(NOT_IN_WORKTREE_MESSAGE,);

  rl.debug('worktree check passed',);
  return args;
}

//endregion Stash worktree enforcement
