import { execFile, } from 'node:child_process';
import { realpath, } from 'node:fs/promises';
import { promisify, } from 'node:util';

import {
  DEFAULT_ALLOWED_WORKTREE_DIRS,
  isAllowedWorktreeDir,
} from './allowed-worktree-dirs.ts';
import { resolveGit, } from './resolve-git.ts';

//region Effective target classification

/* oxlint-disable typescript/strict-void-return -- node:util.promisify intentionally accepts execFile even though execFile also returns a ChildProcess handle; this wrapper only consumes the promise result. */
/**
 * Promisified child_process.execFile used for read-only git queries.
 */
const execFileAsync = promisify(execFile,);
/* oxlint-enable typescript/strict-void-return */

/**
 * Worktree location classification used by linked-worktree-only rules.
 * `allowlisted` marks a repository under a baked-in tool-cache directory whose
 * destructive worktree commands are intentionally exempt from enforcement.
 */
export type EffectiveTarget =
  | 'outside-worktree'
  | 'main-worktree'
  | 'linked-worktree'
  | 'allowlisted';

/**
 * Options for classifying the effective target git would operate on.
 */
type ClassifyEffectiveTargetOptions = {
  /**
   * Pre-subcommand region of the wrapper invocation (global git options).
   */
  readonly preSubcommandArgs: readonly string[];
  /**
   * Effective cwd after `-C` chaining; supplied so query starts in the same place.
   */
  readonly effectiveCwd: string;
  /**
   * Tool-cache roots whose repositories bypass enforcement; injectable for tests, defaults to the baked-in list.
   */
  readonly allowedWorktreeDirs?: readonly string[];
};

/**
 * child_process.execFile error carrying subprocess exit code.
 */
type ExecFileExitError = Error & {
  /**
   * Numeric exit status returned by child process.
   */
  readonly code: number;
};

/**
 * Detects child_process.execFile rejections caused by git exiting non-zero.
 *
 * @param error - Unknown caught value from metadata subprocess.
 *
 * @returns `true` when error represents git process exit code.
 *
 * @example
 * ```ts
 * isExecFileExitError(new Error('fatal'));
 * // => false unless child_process attached numeric code
 * ```
 */
function isExecFileExitError(error: unknown,): error is ExecFileExitError {
  return (Error.isError(error,))
    && ('code' in error)
    && ((typeof error.code) === 'number');
}

/**
 * Removes one trailing line break from git stdout while preserving path text.
 *
 * @param output - stdout text returned by git.
 *
 * @returns Output without final line break.
 *
 * @example
 * ```ts
 * stripTrailingLineBreak('true\n');
 * // => 'true'
 * ```
 */
function stripTrailingLineBreak(output: string,): string {
  if (output.endsWith('\r\n',)) {
    return output.slice(
      0,
      -2,
    );
  }
  if (output.endsWith('\n',)) {
    return output.slice(
      0,
      -1,
    );
  }
  return output;
}

/**
 * Sentinel returned by {@link readGitWorktreeMetadata} when git rev-parse exits
 * non-zero, meaning the caller's repo selection points outside any worktree. A
 * real `Symbol` rather than `undefined` so absence is a distinct domain value
 * the classifier maps to `'outside-worktree'`.
 */
const OUTSIDE_WORKTREE = Symbol('git metadata query found no worktree',);

/**
 * Options for the read-only worktree metadata query.
 */
type ReadGitWorktreeMetadataOptions = {
  /**
   * Absolute path to real git binary.
   */
  readonly gitPath: string;
  /**
   * Pre-subcommand region carried verbatim into the query so repo-selection options apply.
   */
  readonly preSubcommandArgs: readonly string[];
  /**
   * Effective cwd anchored via `-C` so relative `-C` chains resolve from this point.
   */
  readonly effectiveCwd: string;
};

/**
 * Asks real git where the wrapper invocation would land by reusing the
 * original pre-subcommand options (and the inherited process environment).
 * Honouring `--git-dir`, `--work-tree`, `GIT_DIR`, `GIT_WORK_TREE`, and any
 * other repo-selection mechanism the caller used means the classification
 * cannot drift from what the eventual destructive command would see.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param preSubcommandArgs - Global options carried into the query.
 *
 * @param effectiveCwd - Cwd from which the query runs.
 *
 * @returns Stdout text on success, or {@link OUTSIDE_WORKTREE} when
 *   {@link isExecFileExitError} recognises git exiting non-zero (cwd outside
 *   any worktree under the supplied repo selection).
 *
 * @example
 * ```ts
 * await readGitWorktreeMetadata({
 *   gitPath: '/usr/bin/git',
 *   preSubcommandArgs: ['--git-dir', '/repo/.git'],
 *   effectiveCwd: '/repo',
 * });
 * // => 'true\n/repo/.git\n/repo/.git\n'
 * ```
 */
async function readGitWorktreeMetadata({
  gitPath,
  preSubcommandArgs,
  effectiveCwd,
}: ReadGitWorktreeMetadataOptions,): Promise<string | typeof OUTSIDE_WORKTREE> {
  /**
   * Argv that mirrors caller's repo selection while running a read-only rev-parse.
   */
  const queryArgs: readonly string[] = [
    ...preSubcommandArgs,
    '-C',
    effectiveCwd,
    'rev-parse',
    '--path-format=absolute',
    '--is-inside-work-tree',
    '--git-dir',
    '--git-common-dir',
  ];

  try {
    /**
     * Result of read-only git rev-parse using caller repo selection.
     */
    const result = await execFileAsync(
      gitPath,
      [...queryArgs,],
      // Inherit the wrapper's environment so GIT_DIR/GIT_WORK_TREE/etc. apply.
      { env: process.env, },
    );
    return result.stdout;
  }
  catch (error) {
    if (isExecFileExitError(error,))
      return OUTSIDE_WORKTREE;
    throw error;
  }
}

/**
 * Classifies where a guarded git invocation would land by replaying the
 * caller's repo-selection layer (pre-subcommand global options + process env)
 * against real git's `rev-parse`, resolved via {@link resolveGit} and queried
 * through {@link readGitWorktreeMetadata}. This closes the bypass shape where
 * `--git-dir`, `--work-tree`, `GIT_DIR`, or `GIT_WORK_TREE` made the wrapper
 * validate one worktree while the destructive command operated on another.
 *
 * A repository whose resolved git-dir lies under a baked-in tool-cache
 * directory classifies as `allowlisted` via {@link isAllowedWorktreeDir}, so
 * the rule lets it through: those caches belong to tools (e.g. uv) that run
 * destructive git against their own disposable clones.
 *
 * @param preSubcommandArgs - Pre-subcommand region of the wrapper invocation.
 *
 * @param effectiveCwd - Cwd after `-C` chaining was applied.
 *
 * @param allowedWorktreeDirs - Tool-cache roots that yield `allowlisted`; defaults to the baked-in list.
 *
 * @returns Classification used by the linked-worktree-only rule; `allowlisted` when the resolved git-dir sits under an allowed directory.
 *
 * @throws When git rev-parse returns metadata in an unexpected shape.
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
   * Absolute path to real git binary used for read-only worktree query.
   */
  const gitPath = await resolveGit();

  /**
   * Raw git metadata output, or OUTSIDE_WORKTREE when caller selection points outside any worktree.
   */
  const metadata = await readGitWorktreeMetadata({
    gitPath,
    preSubcommandArgs,
    effectiveCwd,
  },);

  if (metadata === OUTSIDE_WORKTREE)
    return 'outside-worktree';

  /**
   * Output lines: inside-worktree flag, absolute git-dir, absolute common-dir.
   */
  const outputLines = stripTrailingLineBreak(metadata,)
    .split('\n',);
  /**
   * Rev-parse metadata fields in output order.
   */
  const [
    isInsideWorktreeOutput,
    gitDir,
    gitCommonDir,
  ] = outputLines;
  /**
   * Whether git reports caller selection lands inside a worktree.
   */
  const isInsideWorktree = isInsideWorktreeOutput === 'true';

  if (!isInsideWorktree)
    return 'outside-worktree';

  if ((gitDir === undefined) || (gitCommonDir === undefined)) {
    throw new Error(
      'cli-git: could not classify git worktree because git rev-parse returned incomplete metadata.',
    );
  }

  /**
   * Real filesystem paths for git-dir and common git dir, used for symlink-stable comparison.
   */
  const [
    resolvedGitDir,
    resolvedGitCommonDir,
  ] = await Promise.all([
    realpath(gitDir,),
    realpath(gitCommonDir,),
  ],);

  // A repository under a baked-in tool-cache directory is exempt: the owning
  // tool (e.g. uv) runs destructive git against its own disposable clones, and
  // the worktree safeguards target the human's repositories, not that plumbing.
  if (await isAllowedWorktreeDir({
    candidatePath: resolvedGitDir,
    allowedDirs: allowedWorktreeDirs,
  },))
    return 'allowlisted';

  return resolvedGitDir === resolvedGitCommonDir
    ? 'main-worktree'
    : 'linked-worktree';
}

//endregion Effective target classification
