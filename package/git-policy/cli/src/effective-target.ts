import {
  DEFAULT_ALLOWED_WORKTREE_DIRS,
  isAllowedWorktreeDir,
} from './allowed-worktree-dirs.ts';
import { resolveGitWorktreeIdentity, } from './git-worktree-identity.ts';
import { resolveGit, } from './resolve-git.ts';

//region Effective target classification

/**
 * Worktree location classification used by linked-worktree-only rules.
 *
 * `allowlisted` marks repository under baked-in tool-cache directory whose
 * destructive worktree commands are intentionally exempt from enforcement.
 */
export type EffectiveTarget =
  | 'outside-worktree'
  | 'main-worktree'
  | 'linked-worktree'
  | 'allowlisted';

/**
 * Options for classifying effective target Git would operate on.
 */
type ClassifyEffectiveTargetOptions = Readonly<{
  /**
   * Pre-subcommand region of wrapper invocation.
   */
  preSubcommandArgs: readonly string[];
  /**
   * Effective cwd after `-C` chaining.
   */
  effectiveCwd: string;
  /**
   * Tool-cache roots whose repositories bypass enforcement.
   */
  allowedWorktreeDirs?: readonly string[];
}>;

/**
 * Classifies policy target while delegating repository identity to shared module.
 *
 * Shared identity resolution replays caller repository selection,
 * including `--git-dir`,
 * `--work-tree`,
 * `GIT_DIR`,
 * and `GIT_WORK_TREE`,
 * against real Git.
 * This policy adapter adds only tool-cache allowlisting and maps bare repositories
 * to outside-worktree because linked-worktree safeguards require filesystem worktree.
 *
 * @param preSubcommandArgs - pre-subcommand Git global option region
 *
 * @param effectiveCwd - cwd after global `-C` chaining
 *
 * @param allowedWorktreeDirs - tool-cache roots yielding `allowlisted`
 *
 * @returns linked-worktree policy target classification
 *
 * @example
 * ```ts
 * await classifyEffectiveTarget({
 *   preSubcommandArgs: ['--git-dir', '/main/.git', '--work-tree', '/main'],
 *   effectiveCwd: '/linked',
 * });
 * // => 'main-worktree'
 * ```
 */
export async function classifyEffectiveTarget({
  preSubcommandArgs,
  effectiveCwd,
  allowedWorktreeDirs = DEFAULT_ALLOWED_WORKTREE_DIRS,
}: ClassifyEffectiveTargetOptions,): Promise<EffectiveTarget> {
  /**
   * Absolute real-Git executable used by shared identity resolver.
   */
  const gitPath = await resolveGit();
  /**
   * Canonical repository identity before policy-specific allowlisting.
   */
  const identity = await resolveGitWorktreeIdentity({
    gitPath,
    preSubcommandArgs,
    effectiveCwd,
  },);
  if ((identity.kind === 'outside-worktree') || (identity.kind === 'bare-repository'))
    return 'outside-worktree';
  if (await isAllowedWorktreeDir({
    candidatePath: identity.gitDir,
    allowedDirs: allowedWorktreeDirs,
  },)) {
    return 'allowlisted';
  }
  return identity.kind;
}

//endregion Effective target classification
