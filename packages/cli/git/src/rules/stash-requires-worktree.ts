import { execFile, } from 'node:child_process';
import { realpath, } from 'node:fs/promises';
import { promisify, } from 'node:util';

import {
  l,
  tagged,
} from '../log.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { resolveGit, } from '../resolve-git.ts';

//region Stash worktree enforcement

/* oxlint-disable typescript/strict-void-return -- node:util.promisify intentionally accepts execFile even though execFile also returns a ChildProcess handle; this wrapper only consumes the promise result. */
/** Promisified child_process.execFile used for read-only git queries. */
const execFileAsync = promisify(execFile,);
/* oxlint-enable typescript/strict-void-return */

/** Git subcommand guarded by this rule. */
const STASH_SUBCOMMAND = 'stash';

/** Environment variable prefix used by Git-specific controls. */
const GIT_ENVIRONMENT_PREFIX = 'GIT_';

/** Diagnostic emitted when stash is requested outside real git worktree. */
const NOT_IN_WORKTREE_MESSAGE =
  'cli-git: git stash requires the effective working directory to be inside a linked git worktree. '
  + 'Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected. '
  + 'cd to a linked worktree root or pass -C <linked-worktree-root> before stash.';

/** Diagnostic emitted when stash is requested from the main git worktree. */
const MAIN_WORKTREE_MESSAGE =
  'cli-git: git stash is rejected in the main git worktree. '
  + 'Refusing to run because git stash can revert primary checkout filesystem state outside what the caller expected. '
  + 'Use a linked worktree for stash operations.';

/** Stash locations that determine whether stash may proceed. */
type StashLocation = 'outside-worktree' | 'main-worktree' | 'linked-worktree';

/** Options for detecting where stash would run. */
type DetectStashLocationOptions = {
  /** Effective cwd after applying pre-subcommand `-C` chaining. */
  readonly effectiveCwd: string;
};

/** Options for reading git worktree metadata. */
type ReadGitWorktreeMetadataOptions = {
  /** Absolute path to real git binary. */
  readonly gitPath: string;
  /** Effective cwd after applying pre-subcommand `-C` chaining. */
  readonly effectiveCwd: string;
};

/** Environment entry from current process env. */
type EnvironmentEntry = readonly [
  string,
  string | undefined,
];

/** child_process.execFile error carrying subprocess exit code. */
type ExecFileExitError = Error & {
  /** Numeric exit status returned by child process. */
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
  return (error instanceof Error)
    && ((typeof (error as Partial<ExecFileExitError>).code) === 'number');
}

/**
 * Keeps environment entries that cannot override Git repository/worktree
 * selection for the read-only detection query.
 *
 * @param entry - Environment key/value pair from current process.
 *
 * @returns `true` when entry should be forwarded to git query.
 *
 * @example
 * ```ts
 * keepGitQueryEnvironmentEntry(['PATH', '/usr/bin']);
 * // => true
 * ```
 */
function keepGitQueryEnvironmentEntry(entry: EnvironmentEntry,): boolean {
  return !entry[0].startsWith(GIT_ENVIRONMENT_PREFIX,);
}

/**
 * Builds environment for read-only git detection query without repository
 * selection variables from current process.
 *
 * @returns Environment safe for cwd-anchored git worktree detection.
 *
 * @example
 * ```ts
 * const env = gitQueryEnvironment();
 * console.log(env.PATH);
 * ```
 */
function gitQueryEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env,).filter(function keepEnvironmentEntry(
      entry: EnvironmentEntry,
    ): boolean {
      return keepGitQueryEnvironmentEntry(entry,);
    },),
  );
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
  if (output.endsWith('\r\n',))
    return output.slice(
      0,
      -2,
    );
  if (output.endsWith('\n',))
    return output.slice(
      0,
      -1,
    );
  return output;
}

/**
 * Reads git worktree metadata for effective cwd, returning undefined when git
 * reports cwd is outside any repository/worktree.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param effectiveCwd - Effective cwd to query through real git.
 *
 * @returns Git stdout for successful metadata query, or `undefined` on git failure.
 *
 * @example
 * ```ts
 * await readGitWorktreeMetadata({ gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 * // => 'true\n/repo/.git\n/repo/.git\n'
 * ```
 */
async function readGitWorktreeMetadata({
  gitPath,
  effectiveCwd,
}: ReadGitWorktreeMetadataOptions,): Promise<string | undefined> {
  try {
    /** Result of read-only Git worktree metadata query. */
    const result = await execFileAsync(
      gitPath,
      [
        '-C',
        effectiveCwd,
        'rev-parse',
        '--path-format=absolute',
        '--is-inside-work-tree',
        '--git-dir',
        '--git-common-dir',
      ],
      { env: gitQueryEnvironment(), },
    );

    return result.stdout;
  }
  catch (error) {
    if (isExecFileExitError(error,))
      return undefined;
    throw error;
  }
}

/**
 * Asks real git where effective cwd sits, ignoring explicit `--git-dir`,
 * `--work-tree`, and `GIT_*` environment controls from original stash
 * invocation so the guard stays anchored to command launch context.
 *
 * @param effectiveCwd - Effective cwd to query through real git.
 *
 * @returns Stash location classification for effective cwd.
 *
 * @example
 * ```ts
 * await detectStashLocation({ effectiveCwd: '/repo', });
 * // => 'main-worktree' for a primary checkout
 * ```
 */
async function detectStashLocation({
  effectiveCwd,
}: DetectStashLocationOptions,): Promise<StashLocation> {
  /** Absolute path to real git binary used for read-only worktree query. */
  const gitPath = await resolveGit();

  /** Raw git metadata output, or undefined when cwd is not in a worktree. */
  const metadata = await readGitWorktreeMetadata({
    gitPath,
    effectiveCwd,
  },);

  if (metadata === undefined)
    return 'outside-worktree';

  /** Output lines: inside-worktree flag, absolute git-dir, absolute common-dir. */
  const outputLines = stripTrailingLineBreak(metadata,).split('\n',);
  /** Rev-parse metadata fields in output order. */
  const [
    isInsideWorktreeOutput,
    gitDir,
    gitCommonDir,
  ] = outputLines;
  /** Whether git reports effective cwd is inside worktree. */
  const isInsideWorktree = isInsideWorktreeOutput === 'true';

  if (!isInsideWorktree)
    return 'outside-worktree';

  if ((gitDir === undefined) || (gitCommonDir === undefined)) {
    throw new Error(
      'cli-git: could not classify git stash worktree because git rev-parse returned incomplete metadata.',
    );
  }

  /** Real filesystem paths for git-dir and common git dir, used for symlink-stable comparison. */
  const [
    resolvedGitDir,
    resolvedGitCommonDir,
  ] = await Promise.all([
    realpath(gitDir,),
    realpath(gitCommonDir,),
  ],);

  return resolvedGitDir === resolvedGitCommonDir
    ? 'main-worktree'
    : 'linked-worktree';
}

/**
 * Rejects `git stash` unless the effective working directory is inside a
 * linked git worktree. `git stash` can update tracked files in the selected
 * worktree, so allowing main-worktree or outside-worktree forms can revert
 * filesystem state outside what the caller expects from current cwd.
 *
 * @param args - Git argv to inspect after wrapper invocation.
 *
 * @returns Original argv when command is not `stash` or cwd is linked worktree.
 *
 * @throws When `stash` is requested outside linked git worktree.
 *
 * @example
 * ```ts
 * await stashRequiresWorktree(['-C', '/repo-linked', 'stash']);
 * // passes when real git reports /repo-linked is a linked worktree
 *
 * await stashRequiresWorktree(['-C', '/repo-main', 'stash']);
 * // throws when /repo-main is the main worktree
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

  /** Effective cwd classification for stash safety policy. */
  const stashLocation = await detectStashLocation({ effectiveCwd, },);

  if (stashLocation === 'outside-worktree')
    throw new Error(NOT_IN_WORKTREE_MESSAGE,);

  if (stashLocation === 'main-worktree')
    throw new Error(MAIN_WORKTREE_MESSAGE,);

  rl.debug('linked worktree check passed',);
  return args;
}

//endregion Stash worktree enforcement
