import { execFileSync, } from 'node:child_process';
import {
  accessSync,
  constants,
  readFileSync,
  realpathSync,
} from 'node:fs';
import {
  delimiter,
  resolve,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/tagged';

import { l as parentLogger, } from './log.ts';

/** Tagged logger for git worktree read allowlist helpers. */
const moduleLogger = tagged({
  tag: 'git-worktree-read-allowlist',
  l: parentLogger,
},);

/** Package name used by cli-git shims that delegate to this workspace's wrapper. */
const CLI_GIT_PACKAGE_NAME = '@monochromatic-dev/cli-git';

/** Built cli-git entry marker used by pnpm shims that do not name package metadata. */
const CLI_GIT_BUNDLED_ENTRY_MARKER = 'packages/cli/git/dist/final/node/index.mjs';

/** Text markers that identify scripts delegating to the workspace git wrapper. */
const CLI_GIT_SELF_SHIM_MARKERS: ReadonlySet<string> = new Set([
  CLI_GIT_PACKAGE_NAME,
  CLI_GIT_BUNDLED_ENTRY_MARKER,
],);

/** Prefix used by `git worktree list --porcelain` to introduce worktree roots. */
const WORKTREE_PORCELAIN_PREFIX = 'worktree ';

/** Maximum time allowed for read-only git metadata probes. */
const GIT_METADATA_QUERY_TIMEOUT_MS = 2_000;

/** Sentinel returned when git metadata query exits non-zero or cannot run. */
const GIT_STDOUT_UNAVAILABLE = Symbol('git-stdout-unavailable',);

/** Result from read-only git stdout query. */
type GitStdoutResult = string | typeof GIT_STDOUT_UNAVAILABLE;

/** Options for resolving real git from a PATH-like value. */
type ResolveRealGitOptions = {
  /** PATH-like string to scan. */
  readonly pathEnv?: string;
};

/** Options for read-only git stdout queries. */
type ReadGitStdoutOptions = {
  /** Absolute path to real git binary. */
  readonly gitPath: string;
  /** Git arguments after executable name. */
  readonly args: readonly string[];
  /** Working directory for git subprocess. */
  readonly cwd: string;
};

/** Options for linked-worktree root classification. */
type IsLinkedWorktreeRootOptions = {
  /** Absolute path to real git binary. */
  readonly gitPath: string;
  /** Candidate worktree root to classify. */
  readonly worktreeRoot: string;
};

/** Options for building read allowlisted directories from git worktree metadata. */
type LinkedWorktreeReadAllowlistedDirsOptions = {
  /** Agent session working directory. */
  readonly cwd: string;
};

/**
 * Formats unknown caught values for debug logs.
 *
 * @param error - Caught value from filesystem or subprocess call.
 *
 * @returns Human-readable error message.
 *
 * @example
 * ```ts
 * formatError(new Error('missing'));
 * // => 'missing'
 * ```
 */
function formatError(error: unknown,): string {
  if (error instanceof Error)
    return error.message;
  return String(error,);
}

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
 * isCliGitShimForSelfSync('/repo/node_modules/.bin/git');
 * // => true when the shim points at \@monochromatic-dev/cli-git
 * ```
 */
function isCliGitShimForSelfSync(candidatePath: string,): boolean {
  try {
    /** Candidate executable bytes decoded as text for wrapper marker scanning. */
    const content = readFileSync(
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
 * const gitPath = resolveRealGitSync();
 * ```
 */
export function resolveRealGitSync({
  pathEnv = process.env
    .PATH
    ?? '',
}: ResolveRealGitOptions = {},): string {
  moduleLogger.debug('resolving real git for linked worktree read allowlist',);

  /** Individual PATH entries, scanned in shell lookup order. */
  const pathDirs = pathEnv.split(delimiter,);

  for (const dir of pathDirs) {
    /** Absolute candidate path for `git` inside this PATH entry. */
    const candidatePath = resolve(
      dir === ''
        ? process.cwd()
        : dir,
      'git',
    );

    try {
      accessSync(
        candidatePath,
        constants.X_OK,
      );
    }
    catch {
      continue;
    }

    if (isCliGitShimForSelfSync(candidatePath,)) {
      moduleLogger.debug(`skipping cli-git wrapper shim at ${candidatePath}`,);
      continue;
    }

    moduleLogger.debug(`resolved real git at ${candidatePath}`,);
    return candidatePath;
  }

  throw new Error('auto-mode: could not find real git binary on PATH.',);
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
 * readGitStdout({ gitPath: '/usr/bin/git', args: ['status', '--porcelain'], cwd: '/repo' });
 * ```
 */
function readGitStdout({
  gitPath,
  args,
  cwd,
}: ReadGitStdoutOptions,): GitStdoutResult {
  try {
    return execFileSync(
      gitPath,
      [...args,],
      {
        cwd,
        encoding: 'utf8',
        stdio: [
          'ignore',
          'pipe',
          'ignore',
        ],
        timeout: GIT_METADATA_QUERY_TIMEOUT_MS,
      },
    );
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
 * isLinkedWorktreeRoot({ gitPath: '/usr/bin/git', worktreeRoot: '/repo-linked' });
 * ```
 */
function isLinkedWorktreeRoot({
  gitPath,
  worktreeRoot,
}: IsLinkedWorktreeRootOptions,): boolean {
  /** Raw rev-parse metadata for candidate worktree root. */
  const metadata = readGitStdout({
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

  /** Rev-parse metadata fields in output order. */
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
    /** Symlink-stable git-dir path. */
    const resolvedGitDir = realpathSync.native(gitDir,);
    /** Symlink-stable common git-dir path. */
    const resolvedGitCommonDir = realpathSync.native(gitCommonDir,);
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
 * The allowlist is intended for `read` tool calls only. It includes linked
 * worktree roots discovered from the session repository and excludes the main
 * worktree root after per-root git metadata classification. Secret-looking
 * paths still trip path signals because `pathSignals` checks them after
 * allowlist containment.
 *
 * @param cwd - Agent session working directory.
 *
 * @returns Linked worktree roots safe to pass as read-only allowlisted dirs.
 *
 * @example
 * ```ts
 * const dirs = linkedWorktreeReadAllowlistedDirs({ cwd: '/repo' });
 * ```
 */
export function linkedWorktreeReadAllowlistedDirs({
  cwd,
}: LinkedWorktreeReadAllowlistedDirsOptions,): readonly string[] {
  moduleLogger.debug(`collecting linked worktree read allowlist from ${cwd}`,);

  try {
    /** Absolute path to real git binary used for read-only metadata queries. */
    const gitPath = resolveRealGitSync();
    /** Raw worktree-list output for repository containing cwd. */
    const worktreeList = readGitStdout({
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

    /** Linked worktree roots reported by git and confirmed via rev-parse metadata. */
    const linkedRoots = extractWorktreePaths(worktreeList,)
      .filter(function keepLinkedWorktreeRoot(worktreeRoot,) {
        return isLinkedWorktreeRoot({
          gitPath,
          worktreeRoot,
        },);
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

