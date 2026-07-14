import { realpath, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  isAbsolute,
  join,
  relative,
  sep,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Logger root for cli-git after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'cli-git', },);

//region Baked-in tool-cache allowlist

/**
 * Parent-directory segment `node:path` `relative` emits when the child escapes
 * the parent. Compared against so containment stays segment-aware rather than
 * matching on a raw `..` prefix that a directory literally named `..foo` would
 * trip.
 */
const PARENT_DIR_SEGMENT = '..';

/**
 * Options for resolving uv's git cache directory.
 */
type ResolveUvCacheDirOptions = {
  /**
   * Environment read for uv cache hints; defaults to the process environment, injectable for tests.
   */
  readonly env?: ForeignBorrowed<NodeJS.ProcessEnv>;
};

/**
 * Resolves uv's git cache directory the way uv itself does, so cli-git can let
 * uv's internal `git reset --hard <sha>` (and the other guarded forms) run
 * against the throwaway clones uv creates there. Resolution order mirrors uv:
 * `UV_CACHE_DIR`, then `${XDG_CACHE_HOME}/uv`, then `${HOME}/.cache/uv`. Empty
 * env values are treated as unset because an exported-but-empty variable is not
 * a real override.
 *
 * @param env - Environment read for uv cache hints; defaults to `process.env`.
 *
 * @returns Absolute path to uv's git cache root.
 *
 * @example
 * ```ts
 * resolveUvCacheDir({ env: { UV_CACHE_DIR: '/custom/uv' } });
 * // => '/custom/uv'
 * ```
 */
export function resolveUvCacheDir({
  env = process.env,
}: ResolveUvCacheDirOptions = {},): string {
  /**
   * uv's explicit cache override; wins when set to a non-empty value.
   */
  const uvCacheDir = env.UV_CACHE_DIR;
  if ((uvCacheDir !== undefined) && (uvCacheDir !== ''))
    return uvCacheDir;

  /**
   * XDG cache root; uv nests its cache under `<xdg>/uv` when this is set.
   */
  const xdgCacheHome = env.XDG_CACHE_HOME;
  /**
   * Cache root the uv cache derives from when no explicit override exists.
   */
  const cacheHome = ((xdgCacheHome !== undefined) && (xdgCacheHome !== ''))
    ? xdgCacheHome
    : join(
      homedir(),
      '.cache',
    );

  return join(
    cacheHome,
    'uv',
  );
}

/**
 * Directories whose repositories are exempt from linked-worktree enforcement.
 * These are third-party tool caches (currently uv's git cache, resolved by
 * {@link resolveUvCacheDir}) where the tool owns disposable clones and runs
 * destructive git itself; cli-git's worktree safeguards exist to discipline
 * the human's repositories, not a tool's internal plumbing. Baked into the
 * binary because the set is a property of the machine's tooling, not of any
 * repository. Add sibling tool caches here as one-line entries when a new
 * tool needs the same exemption.
 */
export const DEFAULT_ALLOWED_WORKTREE_DIRS: readonly string[] = [
  resolveUvCacheDir(),
];

//endregion Baked-in tool-cache allowlist

//region Path containment

/**
 * Options for testing whether one path is contained within another.
 */
type IsPathUnderOptions = {
  /**
   * Ancestor directory the child is tested against.
   */
  readonly parent: string;
  /**
   * Candidate descendant path.
   */
  readonly child: string;
};

/**
 * Segment-aware containment test: `true` when `child` is `parent` itself or
 * sits below it. Uses `node:path` `relative` so `/a/b` does not match `/a/bc`,
 * which a bare `startsWith` would wrongly accept. Both inputs must already be
 * realpath-resolved by the caller so a symlinked component cannot split a true
 * match into a false miss.
 *
 * @param parent - Ancestor directory the child is tested against.
 *
 * @param child - Candidate descendant path.
 *
 * @returns `true` when child is parent or lies beneath it.
 *
 * @example
 * ```ts
 * isPathUnder({ parent: '/a/b', child: '/a/b/c' });
 * // => true
 *
 * isPathUnder({ parent: '/a/b', child: '/a/bc' });
 * // => false
 * ```
 */
export function isPathUnder({
  parent,
  child,
}: IsPathUnderOptions,): boolean {
  /**
   * Path from parent to child; `''` when equal, `..`-led when child escapes.
   */
  const rel = relative(
    parent,
    child,
  );

  if (rel === '')
    return true;

  if (isAbsolute(rel,))
    return false;

  return (rel !== PARENT_DIR_SEGMENT)
    && (!rel.startsWith(`${PARENT_DIR_SEGMENT}${sep}`,));
}

//endregion Path containment

//region Allowlist membership

/**
 * Sentinel returned by {@link safeRealpath} when a directory cannot be resolved
 * (it does not exist on this machine). A real `Symbol` rather than `undefined`
 * so absence is a distinct, intentional value the membership check filters on.
 */
const REALPATH_ABSENT = Symbol('worktree allowlist directory missing on disk',);

/**
 * Options for the worktree allowlist membership test.
 */
type IsAllowedWorktreeDirOptions = {
  /**
   * Realpath-resolved git-dir of the repository the command targets.
   */
  readonly candidatePath: string;
  /**
   * Allowed directory roots; non-existent entries are skipped.
   */
  readonly allowedDirs: readonly string[];
};

/**
 * Resolves a directory through `realpath`, returning {@link REALPATH_ABSENT}
 * instead of throwing when it does not exist. Allowed entries may name paths
 * absent on a given machine (a tool not yet installed), and a missing entry
 * must drop out of the check rather than abort classification.
 *
 * @param path - Directory to resolve.
 *
 * @returns Realpath-resolved directory, or {@link REALPATH_ABSENT} when resolution failed.
 *
 * @example
 * ```ts
 * await safeRealpath('/home/user/.cache/uv');
 * // => '/var/home/user/.cache/uv'
 * ```
 */
async function safeRealpath(path: string,): Promise<string | typeof REALPATH_ABSENT> {
  /**
   * Tagged logger for allowlist realpath resolution.
   */
  const rl = tagged({
    tag: safeRealpath.name,
    l,
  },);
  try {
    return await realpath(path,);
  }
  catch (error: unknown) {
    rl.debug(`allowlist directory realpath failed: ${String(error,)}`,);
    return REALPATH_ABSENT;
  }
}

/**
 * Tests whether the repository's git-dir lies under any allowed directory.
 * Allowed entries are realpath-resolved through {@link safeRealpath} (so a
 * symlinked path component, such as `/home` resolving to `/var/home`, does
 * not defeat the match) before an {@link isPathUnder} segment-aware
 * containment check; `candidatePath` is expected already resolved by the
 * caller.
 *
 * @param candidatePath - Realpath-resolved git-dir of the targeted repository.
 *
 * @param allowedDirs - Allowed directory roots; non-existent entries skipped.
 *
 * @returns `true` when candidate sits under an allowed directory.
 *
 * @example
 * ```ts
 * await isAllowedWorktreeDir({
 *   candidatePath: '/var/home/user/.cache/uv/git-v0/checkouts/x/sha/.git',
 *   allowedDirs: ['/home/user/.cache/uv'],
 * });
 * // => true
 * ```
 */
export async function isAllowedWorktreeDir({
  candidatePath,
  allowedDirs,
}: IsAllowedWorktreeDirOptions,): Promise<boolean> {
  /**
   * Tagged logger for allowlist membership.
   */
  const rl = tagged({
    tag: isAllowedWorktreeDir.name,
    l,
  },);

  /**
   * Allowed roots resolved through realpath; REALPATH_ABSENT marks a dropped entry.
   */
  const resolvedAllowed = await Promise.all(
    allowedDirs.map(async function resolveAllowedDir(dir,): Promise<string | typeof REALPATH_ABSENT> {
      /**
       * Realpath of one allowed entry, or REALPATH_ABSENT when it does not exist.
       */
      const resolved = await safeRealpath(dir,);
      if (resolved === REALPATH_ABSENT)
        rl.debug(`skipping allowed dir that could not be resolved: ${dir}`,);
      return resolved;
    },),
  );

  return resolvedAllowed.some(function candidateUnderAllowed(resolved,): boolean {
    return (resolved !== REALPATH_ABSENT)
      && isPathUnder({
        parent: resolved,
        child: candidatePath,
      },);
  },);
}

//endregion Allowlist membership
