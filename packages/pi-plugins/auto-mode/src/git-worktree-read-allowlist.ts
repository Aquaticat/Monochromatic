import { constants, } from 'node:fs';
import {
  access,
  readFile,
  realpath,
} from 'node:fs/promises';
import {
  delimiter,
  resolve,
} from 'node:path';

import nanoSpawn from 'nano-spawn';
import { caughtValueText as formatError, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for git worktree read allowlist helpers.
 */
const moduleLogger = tagged({
  tag: 'git-worktree-read-allowlist',
  l: parentLogger,
},);

/**
 * Package name used by cli-git shims that delegate to this workspace's wrapper.
 */
const CLI_GIT_PACKAGE_NAME = '@monochromatic-dev/git-policy-cli';

/**
 * Built cli-git entry marker used by pnpm shims that do not name package metadata.
 */
const CLI_GIT_BUNDLED_ENTRY_MARKER = 'packages/git-policy/cli/dist/final/node/index.mjs';

/**
 * Text markers that identify scripts delegating to the workspace git wrapper.
 */
const CLI_GIT_SELF_SHIM_MARKERS: ReadonlySet<string> = new Set([
  CLI_GIT_PACKAGE_NAME,
  CLI_GIT_BUNDLED_ENTRY_MARKER,
],);

/**
 * Prefix used by `git worktree list --porcelain` to introduce worktree roots.
 */
const WORKTREE_PORCELAIN_PREFIX = 'worktree ';

/**
 * Maximum time allowed for read-only git metadata probes.
 */
const GIT_METADATA_QUERY_TIMEOUT_MS = 2_000;

/**
 * Sentinel returned when git metadata query exits non-zero or cannot run.
 */
const GIT_STDOUT_UNAVAILABLE = Symbol('git worktree stdout unavailable during read allowlist',);

/**
 * Sentinel returned when PATH candidate cannot be executed as real git.
 */
const GIT_CANDIDATE_UNAVAILABLE = Symbol('PATH entry missing executable or points at cli-git wrapper',);

/**
 * Result from read-only git stdout query.
 */
type GitStdoutResult = string | typeof GIT_STDOUT_UNAVAILABLE;

/**
 * Result from testing one PATH entry as a real git candidate.
 */
type GitCandidateResult = string | typeof GIT_CANDIDATE_UNAVAILABLE;

/**
 * Options for resolving real git from a PATH-like value.
 */
type ResolveRealGitOptions = {
  /**
   * PATH-like string to scan.
   */
  readonly pathEnv?: string;
};

/**
 * Options for read-only git stdout queries.
 */
type ReadGitStdoutOptions = {
  /**
   * Absolute path to real git binary.
   */
  readonly gitPath: string;
  /**
   * Git arguments after executable name.
   */
  readonly args: readonly string[];
  /**
   * Working directory for git subprocess.
   */
  readonly cwd: string;
};

/**
 * Options for linked-worktree root classification.
 */
type IsLinkedWorktreeRootOptions = {
  /**
   * Absolute path to real git binary.
   */
  readonly gitPath: string;
  /**
   * Candidate worktree root to classify.
   */
  readonly worktreeRoot: string;
};

/**
 * Options for building read allowlisted directories from git worktree metadata.
 */
type LinkedWorktreeReadAllowlistedDirsOptions = {
  /**
   * Agent session working directory.
   */
  readonly cwd: string;
};

/**
 * Removes one trailing line break from git stdout while preserving path text.
 *
 * @param output - Stdout text returned by git.
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
 * Checks whether candidate executable is a shim for this workspace's git wrapper.
 *
 * @param candidatePath - Absolute path to candidate git executable.
 *
 * @returns Whether file content identifies the cli-git wrapper.
 *
 * @example
 * ```ts
 * await isCliGitShimForSelf('/repo/node_modules/.bin/git');
 * // => true when the shim points at \@monochromatic-dev/git-policy-cli
 * ```
 */
async function isCliGitShimForSelf(candidatePath: string,): Promise<boolean> {
  try {
    /**
     * Candidate executable bytes decoded as text for wrapper marker scanning.
     */
    const content = await readFile(
      candidatePath,
      'utf8',
    );
    return [...CLI_GIT_SELF_SHIM_MARKERS,].some(function hasSelfShimMarker(marker,) {
      return content.includes(marker,);
    },);
  }
  catch (error) {
    moduleLogger.debug(
      `could not inspect git candidate ${candidatePath}: ${formatError(error,)}`,
    );
    return false;
  }
}

/**
 * Locates real git by scanning PATH and skipping this workspace's git wrapper shims.
 *
 * @param pathEnv - PATH-like string to scan; defaults to process PATH.
 *
 * @returns Absolute path to real git binary.
 *
 * @throws When no executable git candidate outside the wrapper shim is found.
 *
 * @example
 * ```ts
 * const gitPath = await resolveRealGit();
 * ```
 */
export async function resolveRealGit({
  pathEnv = process.env
    .PATH
    ?? '',
}: ResolveRealGitOptions = {},): Promise<string> {
  moduleLogger.debug('resolving real git for linked worktree read allowlist',);

  /**
   * Individual PATH entries, scanned in shell lookup order.
   */
  const pathDirs = pathEnv.split(delimiter,);
  /**
   * Candidate paths after parallel executable and shim checks, kept in PATH order.
   */
  const candidateResults = await Promise.all(
    pathDirs.map(function resolveGitCandidateForDir(dir,) {
      return resolveGitCandidate(dir,);
    },),
  );
  /**
   * First usable git candidate in shell lookup order.
   */
  const gitPath = candidateResults.find(function candidateIsAvailable(
    candidate,
  ): candidate is string {
    return candidate !== GIT_CANDIDATE_UNAVAILABLE;
  },);

  if (gitPath !== undefined) {
    moduleLogger.debug(`resolved real git at ${gitPath}`,);
    return gitPath;
  }

  throw new Error('auto-mode: could not find real git binary on PATH.',);
}

/**
 * Resolve one PATH directory to a real git executable candidate, skipping
 * self shims detected by {@link isCliGitShimForSelf}.
 *
 * @param dir - PATH entry to inspect.
 *
 * @returns Candidate path, or sentinel when unavailable or self-shimmed.
 *
 * @example
 * ```ts
 * await resolveGitCandidate('/usr/bin');
 * ```
 */
async function resolveGitCandidate(dir: string,): Promise<GitCandidateResult> {
  /**
   * Absolute candidate path for `git` inside this PATH entry.
   */
  const candidatePath = resolve(
    dir === ''
      ? process.cwd()
      : dir,
    'git',
  );

  try {
    await access(
      candidatePath,
      constants.X_OK,
    );
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name so the handled access failure stays traceable.
     */
    const innerL = tagged({
      tag: resolveGitCandidate.name,
      l: moduleLogger,
    },);
    innerL.debug(`git not executable at ${candidatePath}: ${String(error,)}`,);
    return GIT_CANDIDATE_UNAVAILABLE;
  }

  if (await isCliGitShimForSelf(candidatePath,)) {
    moduleLogger.debug(`skipping cli-git wrapper shim at ${candidatePath}`,);
    return GIT_CANDIDATE_UNAVAILABLE;
  }

  return candidatePath;
}

/**
 * Runs read-only git query and captures stdout.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param args - Git arguments after executable name.
 *
 * @param cwd - Working directory for subprocess.
 *
 * @returns Stdout text, or sentinel when git exits non-zero or cannot run.
 *
 * @example
 * ```ts
 * await readGitStdout({ gitPath: '/usr/bin/git', args: ['status', '--porcelain'], cwd: '/repo' });
 * ```
 */
async function readGitStdout({
  gitPath,
  args,
  cwd,
}: ReadGitStdoutOptions,): Promise<GitStdoutResult> {
  try {
    /**
     * Stdout returned by git metadata subprocess.
     */
    const { stdout, } = await nanoSpawn(
      gitPath,
      [...args,],
      {
        cwd,
        stdin: 'ignore',
        stderr: 'ignore',
        timeout: GIT_METADATA_QUERY_TIMEOUT_MS,
      },
    );
    return stdout;
  }
  catch (error) {
    moduleLogger.debug(
      `git metadata query failed in ${cwd}: ${formatError(error,)}`,
    );
    return GIT_STDOUT_UNAVAILABLE;
  }
}

/**
 * Extracts worktree root paths from `git worktree list --porcelain` stdout.
 *
 * @param output - Porcelain worktree-list output.
 *
 * @returns Worktree root paths reported by git.
 *
 * @example
 * ```ts
 * extractWorktreePaths('worktree /repo\nHEAD abc\n\nworktree /repo-linked\n');
 * // => ['/repo', '/repo-linked']
 * ```
 */
function extractWorktreePaths(output: string,): readonly string[] {
  return stripTrailingLineBreak(output,)
    .split('\n',)
    .filter(function isWorktreeLine(line,) {
      return line.startsWith(WORKTREE_PORCELAIN_PREFIX,);
    },)
    .map(function worktreeLinePath(line,) {
      return line.slice(WORKTREE_PORCELAIN_PREFIX.length,);
    },)
    .filter(function hasWorktreePath(worktreePath,) {
      return worktreePath !== '';
    },);
}

/**
 * Classifies candidate root as a linked git worktree using real git metadata.
 *
 * @param gitPath - Absolute path to real git binary.
 *
 * @param worktreeRoot - Candidate worktree root to classify.
 *
 * @returns Whether candidate is a linked worktree rather than main worktree.
 *
 * @example
 * ```ts
 * await isLinkedWorktreeRoot({ gitPath: '/usr/bin/git', worktreeRoot: '/repo-linked' });
 * ```
 */
async function isLinkedWorktreeRoot({
  gitPath,
  worktreeRoot,
}: IsLinkedWorktreeRootOptions,): Promise<boolean> {
  /**
   * Raw rev-parse metadata for candidate worktree root.
   */
  const metadata = await readGitStdout({
    gitPath,
    cwd: worktreeRoot,
    args: [
      'rev-parse',
      '--path-format=absolute',
      '--is-inside-work-tree',
      '--git-dir',
      '--git-common-dir',
    ],
  },);

  if (metadata === GIT_STDOUT_UNAVAILABLE)
    return false;

  /**
   * Rev-parse metadata fields in output order.
   */
  const [
    isInsideWorktreeOutput,
    gitDir,
    gitCommonDir,
  ] = stripTrailingLineBreak(metadata,)
    .split('\n',);

  if (isInsideWorktreeOutput !== 'true')
    return false;
  if ((gitDir === undefined) || (gitCommonDir === undefined))
    return false;

  try {
    /**
     * Symlink-stable git-dir path.
     */
    const resolvedGitDir = await realpath(gitDir,);
    /**
     * Symlink-stable common git-dir path.
     */
    const resolvedGitCommonDir = await realpath(gitCommonDir,);
    return resolvedGitDir !== resolvedGitCommonDir;
  }
  catch (error) {
    moduleLogger.debug(
      `could not canonicalize git metadata for ${worktreeRoot}: ${formatError(error,)}`,
    );
    return false;
  }
}

/**
 * Returns linked worktree roots attached to current repository for read allowlisting.
 *
 * Resolves the real git binary with {@link resolveRealGit}, lists worktrees
 * with {@link readGitStdout} and {@link extractWorktreePaths}, and classifies
 * each root with {@link isLinkedWorktreeRoot}.
 *
 * The allowlist is intended for `read` tool calls only. It includes linked
 * worktree roots discovered from the session repository and excludes the main
 * worktree root after per-root git metadata classification. Secret-looking
 * paths still trip path signals because {@link pathSignals} checks them after
 * allowlist containment.
 *
 * @param cwd - Agent session working directory.
 *
 * @returns Linked worktree roots safe to pass as read-only allowlisted dirs.
 *
 * @example
 * ```ts
 * const dirs = await linkedWorktreeReadAllowlistedDirs({ cwd: '/repo' });
 * ```
 */
export async function linkedWorktreeReadAllowlistedDirs({
  cwd,
}: LinkedWorktreeReadAllowlistedDirsOptions,): Promise<readonly string[]> {
  moduleLogger.debug(`collecting linked worktree read allowlist from ${cwd}`,);

  try {
    /**
     * Absolute path to real git binary used for read-only metadata queries.
     */
    const gitPath = await resolveRealGit();
    /**
     * Raw worktree-list output for repository containing cwd.
     */
    const worktreeList = await readGitStdout({
      gitPath,
      cwd,
      args: [
        'worktree',
        'list',
        '--porcelain',
      ],
    },);

    if (worktreeList === GIT_STDOUT_UNAVAILABLE)
      return [];

    /**
     * Worktree roots reported by git before linked-worktree classification.
     */
    const worktreeRoots = extractWorktreePaths(worktreeList,);
    /**
     * Per-root linked-worktree decisions in the same order as `worktreeRoots`.
     */
    const linkedRootDecisions = await Promise.all(
      worktreeRoots.map(function classifyWorktreeRoot(worktreeRoot,) {
        return isLinkedWorktreeRoot({
          gitPath,
          worktreeRoot,
        },);
      },),
    );
    /**
     * Linked worktree roots reported by git and confirmed via rev-parse metadata.
     */
    const linkedRoots = worktreeRoots.filter(function keepLinkedWorktreeRoot(
      _worktreeRoot,
      index,
    ) {
      return linkedRootDecisions[index] === true;
    },);

    moduleLogger.debug(
      `linked worktree read allowlist contains ${String(linkedRoots.length,)} roots`,
    );
    return linkedRoots;
  }
  catch (error) {
    moduleLogger.debug(
      `linked worktree read allowlist disabled: ${formatError(error,)}`,
    );
    return [];
  }
}
