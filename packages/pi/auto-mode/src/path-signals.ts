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

import * as nodePath from 'node:path';
import { SECRET_PATH_PATTERN, } from './constants.ts';
import type { SignalContext, } from './types.ts';

/**
 * Check if a file path should trigger flagging.
 *
 * Bug fix: `isSystemPath` removed from upstream. It caused
 * false positives on `/var/home/user` which is a common
 * home directory on some Linux systems. The `!isUnder(resolved, cwd)`
 * check already catches paths outside the project directory.
 *
 * @returns `true` if the path should be flagged
 *
 * @example
 * ```typescript
 * pathSignals({ filePath: "/etc/passwd", ctx: { cwd: "/project", home: "/home/user" } }); // true
 * pathSignals({ filePath: "./src/index.ts", ctx: { cwd: "/project", home: "/home/user" } }); // false
 * ```
 */
function pathSignals(
  {
    filePath,
    ctx,
  }: {
    filePath: string;
    ctx: SignalContext;
  },
): boolean {
  /** Cached resolution shared by the cwd-containment, dotfile, and secret-pattern checks below. */
  const resolved = resolvePath({
    filePath,
    cwd: ctx.cwd,
  },);

  if (!isUnder({
    resolved,
    dir: ctx.cwd,
  },)) {
    return true;
  }

  if (isHomeDotfile({
    resolved,
    home: ctx.home,
  },)) {
    return true;
  }

  if (SECRET_PATH_PATTERN.test(filePath,))
    return true;

  return false;
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
    filePath: string;
    cwd: string;
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
    resolved: string;
    dir: string;
  },
): boolean {
  /** Trailing slash prevents `/foo` from matching `/foobar` via `startsWith`. */
  const norm = dir.endsWith('/',) ? dir : `${dir}/`;
  return (resolved === dir) || resolved
    .startsWith(norm,);
}

/**
 * Check if a resolved path is a dotfile or dotdir in the home directory.
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
    resolved: string;
    home: string;
  },
): boolean {
  if (!isUnder({
    resolved,
    dir: home,
  },)) {
    return false;
  }
  /** Slice of `resolved` after the home prefix; the leading `/` (if any) is consumed below. */
  const afterHome = resolved.slice(home.length,);
  /** Home-relative path; first segment determines whether this is a dotfile/dotdir under `~`. */
  const relative = afterHome.startsWith('/',)
    ? afterHome.slice(1,)
    : afterHome;
  /** Default `''` covers the empty-relative case (path equals home directory). */
  const [first = '',] = relative.split('/',);
  return first.startsWith('.',);
}

export {
  isHomeDotfile,
  isUnder,
  pathSignals,
  resolvePath,
};
