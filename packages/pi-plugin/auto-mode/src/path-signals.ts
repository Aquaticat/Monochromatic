/**
 * Path-based signal detection.
 *
 * Owns the path-handling lobe of the flagger:
 * - `pathSignals`: top-level "should this path be flagged?" check.
 * - `resolvePath`/`isUnder`/`isHomeDotfile`: helpers used by
 *   `pathSignals` and the bash-parser to make path comparisons
 *   that respect `~` expansion, cwd containment, and home dotfiles.
 *
 * Path logic stays separate from content/text logic
 * (`content-signals.ts`) and tool-event introspection
 * (`tool-helpers.ts`) so each lobe can change independently.
 *
 * @module
 */

import { realpath, } from 'node:fs/promises';
import * as nodePath from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { SECRET_PATH_PATTERN, } from './constants.ts';
import type { SignalContext, } from './types.ts';

//region Logging

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
 * Tagged logger for the path-signals module.
 */
const moduleLogger = tagged({
  tag: 'path-signals',
  l: parentLogger,
},);

//endregion Logging

/**
 * Sentinel for paths whose canonical filesystem target cannot be resolved.
 *
 * @example
 * ```typescript
 * const missing = REALPATH_UNAVAILABLE;
 * ```
 */
const REALPATH_UNAVAILABLE = Symbol('path signal realpath unavailable for target',);

/**
 * Result from attempting filesystem canonicalisation.
 *
 * @example
 * ```typescript
 * const result: RealpathResult = REALPATH_UNAVAILABLE;
 * ```
 */
type RealpathResult = string | typeof REALPATH_UNAVAILABLE;

/**
 * Check if a file path should trigger flagging.
 *
 * Bug fix: `isSystemPath` removed from upstream. It caused
 * false positives on `/var/home/user` which is a common
 * home directory on some Linux systems. The `!isUnder(resolved, cwd)`
 * check already catches paths outside the project directory.
 *
 * Delegates to {@link resolvePath} and {@link tryRealpath} to canonicalise
 * the target, {@link isAllowlistedPath} to honor per-call allowlists,
 * {@link isUnder} for cwd containment, {@link isHomeDotfile} for home
 * dotfile detection, and {@link hasSecretPathSignal} for secret-looking
 * names; {@link realpathOrLexical} canonicalises cwd and home for the
 * comparison.
 *
 * @returns `true` if the path should be flagged
 *
 * @example
 * ```typescript
 * pathSignals({ filePath: "/etc/passwd", ctx: { cwd: "/project", home: "/home/user" } }); // true
 * pathSignals({ filePath: "./src/index.ts", ctx: { cwd: "/project", home: "/home/user" } }); // false
 * pathSignals({
 *   filePath: "/tmp/agent/example/src/index.ts",
 *   ctx,
 *   allowlistedDirs: ["/tmp/agent"],
 * }); // false
 * const allowlistedDirs = ["/home/user/.agents/skills/example"];
 * pathSignals({
 *   filePath: "/home/user/.agents/skills/example/.env",
 *   ctx,
 *   allowlistedDirs,
 * }); // true
 * ```
 */
async function pathSignals(
  {
    filePath,
    ctx,
    allowlistedDirs = [],
  }: {
    readonly filePath: string;
    readonly ctx: SignalContext;
    /**
     * Directories whose contents should not trip location-based signals for this call.
     */
    readonly allowlistedDirs?: readonly string[];
  },
): Promise<boolean> {
  /**
   * Cached lexical resolution shared by cwd containment, allowlist, dotfile, and secret checks.
   */
  const resolved = resolvePath({
    filePath,
    cwd: ctx.cwd,
  },);
  /**
   * Canonical target path when `filePath` exists; missing paths fall back to lexical checks.
   */
  const canonicalResolved = await tryRealpath(resolved,);
  /**
   * Path used for location checks; canonical targets prevent symlink escape bypasses.
   */
  const signalPath = canonicalResolved === REALPATH_UNAVAILABLE
    ? resolved
    : canonicalResolved;
  /**
   * Cwd used for containment checks; canonicalised when the target was canonicalised too.
   */
  const signalCwd = canonicalResolved === REALPATH_UNAVAILABLE
    ? ctx.cwd
    : await realpathOrLexical(ctx.cwd,);
  /**
   * Home used for dotfile checks; canonicalised when the target was canonicalised too.
   */
  const signalHome = canonicalResolved === REALPATH_UNAVAILABLE
    ? ctx.home
    : await realpathOrLexical(ctx.home,);

  /**
   * Whether this call targets a per-call allowlisted directory such as a loaded skill root.
   */
  const allowlisted = await isAllowlistedPath({
    canonicalResolved,
    cwd: ctx.cwd,
    allowlistedDirs,
  },);

  if ((!allowlisted)
    && (!isUnder({
      resolved: signalPath,
      dir: signalCwd,
    },))) {
    return true;
  }

  if ((!allowlisted)
    && isHomeDotfile({
      resolved: signalPath,
      home: signalHome,
    },)) {
    return true;
  }

  if (hasSecretPathSignal({
    filePath,
    resolved,
    canonicalResolved,
  },)) {
    return true;
  }

  return false;
}

/**
 * Check whether canonical target is under any canonical allowlisted directory.
 *
 * Canonicalises each allowlisted root with {@link tryRealpath} before
 * comparing containment with {@link isUnder}.
 *
 * @param canonicalResolved - canonical target path, when target exists
 *
 * @param cwd - working directory used for resolving relative allowlist entries
 *
 * @param allowlistedDirs - directory roots trusted for this read-like operation
 *
 * @returns whether canonical target stays inside canonical allowlist boundary
 *
 * @example
 * ```typescript
 * isAllowlistedPath({
 *   canonicalResolved: "/tmp/agent/repo/index.ts",
 *   cwd: "/project",
 *   allowlistedDirs: ["/tmp/agent"],
 * }); // true
 * ```
 */
async function isAllowlistedPath(
  {
    canonicalResolved,
    cwd,
    allowlistedDirs,
  }: {
    readonly canonicalResolved: RealpathResult;
    readonly cwd: string;
    readonly allowlistedDirs: readonly string[];
  },
): Promise<boolean> {
  if (canonicalResolved === REALPATH_UNAVAILABLE)
    return false;

  /**
   * Per-allowlist containment decisions for this canonical target.
   */
  const containmentDecisions = await Promise.all(
    allowlistedDirs.map(async function allowlistedDirContainsCanonicalPath(dir,) {
      /**
       * Canonical allowlisted root; missing roots fail closed.
       */
      const canonicalDir = await tryRealpath(nodePath.resolve(
        cwd,
        dir,
      ),);
      return (canonicalDir !== REALPATH_UNAVAILABLE)
        && isUnder({
          resolved: canonicalResolved,
          dir: canonicalDir,
        },);
    },),
  );
  return containmentDecisions.some(Boolean,);
}

/**
 * Check raw, lexical, and canonical path spellings against
 * {@link SECRET_PATH_PATTERN} for secret-looking names.
 *
 * @param filePath - original path string supplied to tool call
 *
 * @param resolved - lexical absolute path after cwd or home expansion
 *
 * @param canonicalResolved - canonical filesystem target, when target exists
 *
 * @returns whether any spelling exposes secret-related path markers
 *
 * @example
 * ```typescript
 * hasSecretPathSignal({
 *   filePath: "/tmp/agent/link",
 *   resolved: "/tmp/agent/link",
 *   canonicalResolved: "/tmp/agent/repo/.env",
 * }); // true
 * ```
 */
function hasSecretPathSignal(
  {
    filePath,
    resolved,
    canonicalResolved,
  }: {
    readonly filePath: string;
    readonly resolved: string;
    readonly canonicalResolved: RealpathResult;
  },
): boolean {
  /**
   * Path spellings tested so symlinks cannot hide secret-looking target names.
   */
  const candidates = [
    filePath,
    resolved,
    ...(canonicalResolved === REALPATH_UNAVAILABLE ? [] : [canonicalResolved,]),
  ];
  return candidates.some(
    function matchesSecretPathPattern(candidate,) {
      return SECRET_PATH_PATTERN.test(candidate,);
    },
  );
}

/**
 * Resolve filesystem path to canonical target without throwing for absent paths.
 *
 * @param path - filesystem path that may include symlinks
 *
 * @returns canonical filesystem path, or sentinel when missing or inaccessible
 *
 * @example
 * ```typescript
 * const canonical = tryRealpath("/tmp/agent/repo");
 * ```
 */
async function tryRealpath(
  path: string,
): Promise<RealpathResult> {
  try {
    return await realpath(path,);
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name so the handled realpath failure stays traceable.
     */
    const innerL = tagged({
      tag: tryRealpath.name,
      l: moduleLogger,
    },);
    innerL.debug(`realpath failed for ${path}: ${String(error,)}`,);
    return REALPATH_UNAVAILABLE;
  }
}

/**
 * Resolve filesystem path to canonical target via {@link tryRealpath},
 * falling back to original spelling.
 *
 * @param path - filesystem path that may include symlinks
 *
 * @returns canonical filesystem path when available, otherwise original path
 *
 * @example
 * ```typescript
 * const path = realpathOrLexical("/tmp/agent/repo");
 * ```
 */
async function realpathOrLexical(
  path: string,
): Promise<string> {
  /**
   * Result from realpath probe before sentinel fallback.
   */
  const result = await tryRealpath(path,);
  if (result === REALPATH_UNAVAILABLE)
    return path;
  return result;
}

/**
 * Resolve a file path relative to cwd, handling `~` expansion.
 *
 * @returns the resolved absolute path
 *
 * @example
 * ```typescript
 * resolvePath({ filePath: "~/.bashrc", cwd: "/project" }); // "/home/user/.bashrc"
 * ```
 */
function resolvePath(
  {
    filePath,
    cwd,
  }: {
    readonly filePath: string;
    readonly cwd: string;
  },
): string {
  if (filePath.startsWith('~',)) {
    return nodePath.resolve(
      process.env
        .HOME
        ?? '/home',
      filePath.slice(1,)
        .startsWith('/',)
        ? filePath.slice(2,)
        : filePath.slice(1,),
    );
  }
  return nodePath.resolve(
    cwd,
    filePath,
  );
}

/**
 * Check if a resolved path is under a given directory.
 *
 * @returns `true` if the path is under or equal to the directory
 *
 * @example
 * ```typescript
 * isUnder({ resolved: "/home/user/project/src", dir: "/home/user/project" }); // true
 * isUnder({ resolved: "/etc/passwd", dir: "/home/user/project" }); // false
 * ```
 */
function isUnder(
  {
    resolved,
    dir,
  }: {
    readonly resolved: string;
    readonly dir: string;
  },
): boolean {
  /**
   * Trailing slash prevents `/foo` from matching `/foobar` via `startsWith`.
   */
  const norm = dir.endsWith('/',) ? dir : `${dir}/`;
  return (resolved === dir) || resolved
    .startsWith(norm,);
}

/**
 * Check if a resolved path is a dotfile or dotdir in the home directory,
 * using {@link isUnder} for the home-containment check.
 *
 * @returns `true` if the path is a dotfile/dotdir in home
 *
 * @example
 * ```typescript
 * isHomeDotfile({ resolved: "/home/user/.ssh/id_rsa", home: "/home/user" }); // true
 * isHomeDotfile({ resolved: "/home/user/project/file", home: "/home/user" }); // false
 * ```
 */
function isHomeDotfile(
  {
    resolved,
    home,
  }: {
    readonly resolved: string;
    readonly home: string;
  },
): boolean {
  if (!isUnder({
    resolved,
    dir: home,
  },)) {
    return false;
  }
  /**
   * Slice of `resolved` after the home prefix; the leading `/` (if any) is consumed below.
   */
  const afterHome = resolved.slice(home.length,);
  /**
   * Home-relative path; first segment determines whether this is a dotfile/dotdir under `~`.
   */
  const relative = afterHome.startsWith('/',)
    ? afterHome.slice(1,)
    : afterHome;
  /**
   * Default `''` covers the empty-relative case (path equals home directory).
   */
  const [first = '',] = relative.split('/',);
  return first.startsWith('.',);
}

export {
  isHomeDotfile,
  isUnder,
  pathSignals,
  resolvePath,
};
