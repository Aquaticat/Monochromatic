/**
 * Repository and workspace root discovery with cross-runtime filesystem support.
 *
 * Locates roots by searching upward for marker files or directories:
 *
 * - `mise.toml` containing `[monorepo]`
 * - `.git` as a Git directory or gitfile marker
 * - `pnpm-workspace.yaml`
 *
 * Shared walking code lives in `root-discovery.ts`.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/tagged';

import {
  findRootByWalkingUp,
  type RootMatcherArgs,
} from './root-discovery.ts';

//region Types and constants

/** Optional starting directory for uncached root finders. */
type RootSearchOptions = {
  /** Starting directory for upward search. Defaults to current process cwd. */
  readonly cwd?: string | undefined;
};

/** Process-lifetime root promise cache used by cached root finders. */
type RootCache = {
  /** In-flight or resolved root promise captured on first call. */
  root?: Promise<string>;
};

/** Marker string that identifies the monorepo root `mise.toml`. */
const MONOREPO_SECTION_MARKER = '\n[monorepo]\n';

/** Marker path that identifies a Git repository root. */
const GIT_MARKER_BASENAME = '.git';

/** Manifest path that identifies a pnpm workspace root. */
const PNPM_WORKSPACE_MANIFEST = 'pnpm-workspace.yaml';

/** Error text for missing mise monorepo root. */
const MISE_ROOT_MISSING_MESSAGE =
  'Could not find monorepo root (no mise.toml with [monorepo] section found upward)';

/** Error text for missing Git repository root. */
const GIT_ROOT_MISSING_MESSAGE =
  'Could not find Git repository root (no .git marker found upward)';

/** Error text for missing pnpm workspace root. */
const PNPM_ROOT_MISSING_MESSAGE =
  'Could not find pnpm workspace root (no pnpm-workspace.yaml found upward)';

/** Tagged logger for public root finder entry points. */
const rootFinderLogger = tagged({ tag: 'findMonorepoRoot', },);

/**
 * Process-lifetime cache for {@link findMiseMonorepoRootCached}.
 */
const miseRootCache: RootCache = {};

/**
 * Process-lifetime cache for {@link findGitRepoRootCached}.
 */
const gitRootCache: RootCache = {};

/**
 * Process-lifetime cache for {@link findPnpmWorkspaceRootCached}.
 */
const pnpmRootCache: RootCache = {};

//endregion Types and constants

//region Matchers

/**
 * Checks whether a directory contains a monorepo `mise.toml` marker.
 *
 * @param dir - candidate directory
 *
 * @param fs - filesystem backend
 *
 * @returns `true` when candidate is mise monorepo root
 *
 * @example
 * ```ts
 * await matchesMiseMonorepoRoot({ dir: '/repo', fs });
 * ```
 */
async function matchesMiseMonorepoRoot({
  dir,
  fs,
}: RootMatcherArgs,): Promise<boolean> {
  /** Candidate `mise.toml` content, or `undefined` when absent. */
  const content = await fs.readTextFile(`${dir}/mise.toml`,);
  return (content !== undefined) && content.includes(MONOREPO_SECTION_MARKER,);
}

/**
 * Checks whether a directory contains a Git root marker.
 *
 * `.git` may be a directory or a gitfile, so existence of any filesystem entry
 * kind is enough.
 *
 * @param dir - candidate directory
 *
 * @param fs - filesystem backend
 *
 * @returns `true` when candidate is Git repository root
 *
 * @example
 * ```ts
 * await matchesGitRepoRoot({ dir: '/repo', fs });
 * ```
 */
function matchesGitRepoRoot({
  dir,
  fs,
}: RootMatcherArgs,): Promise<boolean> {
  return fs.exists(`${dir}/${GIT_MARKER_BASENAME}`,);
}

/**
 * Checks whether a directory contains a pnpm workspace manifest.
 *
 * @param dir - candidate directory
 *
 * @param fs - filesystem backend
 *
 * @returns `true` when candidate is pnpm workspace root
 *
 * @example
 * ```ts
 * await matchesPnpmWorkspaceRoot({ dir: '/repo', fs });
 * ```
 */
function matchesPnpmWorkspaceRoot({
  dir,
  fs,
}: RootMatcherArgs,): Promise<boolean> {
  return fs.exists(`${dir}/${PNPM_WORKSPACE_MANIFEST}`,);
}

/**
 * Logs start of a public root finder call.
 *
 * @param functionName - public finder name used as logger tag
 *
 * @param cwd - caller-provided starting directory
 *
 * @example
 * ```ts
 * logRootSearchStart({ functionName: findGitRepoRoot.name });
 * ```
 */
function logRootSearchStart({
  functionName,
  cwd,
}: {
  readonly functionName: string;
  readonly cwd?: string | undefined;
},): void {
  /** Logger tagged with current public finder name. */
  const functionLogger = tagged({
    tag: functionName,
    l: rootFinderLogger,
  },);
  functionLogger.debug(`searching from ${cwd ?? '<process.cwd()>'}`,);
}

//endregion Matchers

//region Mise monorepo root

/**
 * Finds the mise monorepo root directory by searching upward from `cwd`
 * for a `mise.toml` containing `[monorepo]`.
 *
 * Normalizes the result to use `/var/home` instead of `/home` on Fedora ostree.
 *
 * @param cwd - starting directory for upward search, defaults to `process.cwd()`
 *
 * @returns absolute path to monorepo root
 *
 * @throws when no ancestor directory contains a `mise.toml` with `[monorepo]`
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRoot();
 * ```
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRoot({ cwd: import.meta.dirname });
 * ```
 */
export function findMiseMonorepoRoot(
  { cwd, }: RootSearchOptions = {},
): Promise<string> {
  logRootSearchStart({
    functionName: findMiseMonorepoRoot.name,
    cwd,
  },);
  return findRootByWalkingUp({
    cwd,
    matches: matchesMiseMonorepoRoot,
    missingMessage: MISE_ROOT_MISSING_MESSAGE,
  },);
}

/**
 * Memoised variant of {@link findMiseMonorepoRoot} that locks in first result.
 *
 * First call starts the walk from current `process.cwd()`. Later calls return
 * the same in-flight, fulfilled, or rejected promise for process lifetime.
 *
 * @returns absolute path to monorepo root, locked in at first call
 *
 * @throws same rejection from first walk when no ancestor contains marker
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRootCached();
 * ```
 */
export function findMiseMonorepoRootCached(): Promise<string> {
  miseRootCache.root ??= findMiseMonorepoRoot();
  return miseRootCache.root;
}

//endregion Mise monorepo root

//region Git repository root

/**
 * Finds Git repository root directory by searching upward from `cwd` for `.git`.
 *
 * Accepts both normal `.git` directories and gitfile markers used by worktrees
 * and submodules. Normalizes `/home` roots to `/var/home` on Fedora ostree.
 *
 * @param cwd - starting directory for upward search, defaults to `process.cwd()`
 *
 * @returns absolute path to Git repository root
 *
 * @throws when no ancestor directory contains a `.git` marker
 *
 * @example
 * ```ts
 * const root = await findGitRepoRoot();
 * ```
 *
 * @example
 * ```ts
 * const root = await findGitRepoRoot({ cwd: import.meta.dirname });
 * ```
 */
export function findGitRepoRoot({ cwd, }: RootSearchOptions = {},): Promise<string> {
  logRootSearchStart({
    functionName: findGitRepoRoot.name,
    cwd,
  },);
  return findRootByWalkingUp({
    cwd,
    matches: matchesGitRepoRoot,
    missingMessage: GIT_ROOT_MISSING_MESSAGE,
  },);
}

/**
 * Memoised variant of {@link findGitRepoRoot} that locks in first result.
 *
 * First call starts the walk from current `process.cwd()`. Later calls return
 * the same in-flight, fulfilled, or rejected promise for process lifetime.
 *
 * @returns absolute path to Git repository root, locked in at first call
 *
 * @throws same rejection from first walk when no ancestor contains `.git`
 *
 * @example
 * ```ts
 * const root = await findGitRepoRootCached();
 * ```
 */
export function findGitRepoRootCached(): Promise<string> {
  gitRootCache.root ??= findGitRepoRoot();
  return gitRootCache.root;
}

//endregion Git repository root

//region pnpm workspace root

/**
 * Finds pnpm workspace root directory by searching upward from `cwd` for
 * `pnpm-workspace.yaml`.
 *
 * Normalizes `/home` roots to `/var/home` on Fedora ostree.
 *
 * @param cwd - starting directory for upward search, defaults to `process.cwd()`
 *
 * @returns absolute path to pnpm workspace root
 *
 * @throws when no ancestor directory contains `pnpm-workspace.yaml`
 *
 * @example
 * ```ts
 * const root = await findPnpmWorkspaceRoot();
 * ```
 *
 * @example
 * ```ts
 * const root = await findPnpmWorkspaceRoot({ cwd: import.meta.dirname });
 * ```
 */
export function findPnpmWorkspaceRoot(
  { cwd, }: RootSearchOptions = {},
): Promise<string> {
  logRootSearchStart({
    functionName: findPnpmWorkspaceRoot.name,
    cwd,
  },);
  return findRootByWalkingUp({
    cwd,
    matches: matchesPnpmWorkspaceRoot,
    missingMessage: PNPM_ROOT_MISSING_MESSAGE,
  },);
}

/**
 * Memoised variant of {@link findPnpmWorkspaceRoot} that locks in first result.
 *
 * First call starts the walk from current `process.cwd()`. Later calls return
 * the same in-flight, fulfilled, or rejected promise for process lifetime.
 *
 * @returns absolute path to pnpm workspace root, locked in at first call
 *
 * @throws same rejection from first walk when no ancestor contains manifest
 *
 * @example
 * ```ts
 * const root = await findPnpmWorkspaceRootCached();
 * ```
 */
export function findPnpmWorkspaceRootCached(): Promise<string> {
  pnpmRootCache.root ??= findPnpmWorkspaceRoot();
  return pnpmRootCache.root;
}

//endregion pnpm workspace root
