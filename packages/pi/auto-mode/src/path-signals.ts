/**
 * Path-related signal functions.
 *
 * Extracted from signals.ts to stay within the line limit.
 * Contains pathSignals, resolvePath, isUnder, isHomeDotfile.
 *
 * @module
 */

import * as nodePath from "node:path";
import type { SignalContext, } from "./types.ts";
import { SECRET_PATH_PATTERN, } from "./constants.ts";

/**
 * Check if a file path should trigger flagging.
 *
 * Bug fix: `isSystemPath` removed from upstream. It caused
 * false positives on `/var/home/user` which is a common
 * home directory on some Linux systems. The `!isUnder(resolved, cwd)`
 * check already catches paths outside the project directory.
 *
 * @param filePath - the file path to check
 *
 * @param ctx - signal context with cwd and home directory
 *
 * @returns `true` if the path should be flagged
 *
 * @example
 * ```typescript
 * pathSignals("/etc/passwd", { cwd: "/project", home: "/home/user" }); // true
 * pathSignals("./src/index.ts", { cwd: "/project", home: "/home/user" }); // false
 * ```
 */
function pathSignals(
  filePath: string,
  ctx: SignalContext,
): boolean {
  const resolved = resolvePath(
    filePath,
    ctx.cwd,
  );

  if (!isUnder(
    resolved,
    ctx.cwd
  )) return true;

  if (isHomeDotfile(
    resolved,
    ctx.home
  )) return true;

  if (SECRET_PATH_PATTERN.test(filePath)) return true;

  return false;
}

/**
 * Resolve a file path relative to cwd, handling `~` expansion.
 *
 * @param filePath - the file path to resolve
 *
 * @param cwd - the current working directory
 *
 * @returns the resolved absolute path
 *
 * @example
 * ```typescript
 * resolvePath("~/.bashrc", "/project"); // "/home/user/.bashrc"
 * ```
 */
function resolvePath(
  filePath: string,
  cwd: string,
): string {
  if (filePath.startsWith("~")) {
    return nodePath.resolve(
      process.env.HOME ?? "/home",
      filePath.slice(1).replace(
        /^\//,
        "",
      ),
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
 * @param resolved - the resolved absolute path
 *
 * @param dir - the directory to check against
 *
 * @returns `true` if the path is under or equal to the directory
 *
 * @example
 * ```typescript
 * isUnder("/home/user/project/src", "/home/user/project"); // true
 * isUnder("/etc/passwd", "/home/user/project"); // false
 * ```
 */
function isUnder(
  resolved: string,
  dir: string,
): boolean {
  const norm = dir.endsWith("/") ? dir : `${dir}/`;
  return resolved === dir || resolved.startsWith(norm);
}

/**
 * Check if a resolved path is a dotfile or dotdir in the home directory.
 *
 * @param resolved - the resolved absolute path
 *
 * @param home - the home directory
 *
 * @returns `true` if the path is a dotfile/dotdir in home
 *
 * @example
 * ```typescript
 * isHomeDotfile("/home/user/.ssh/id_rsa", "/home/user"); // true
 * isHomeDotfile("/home/user/project/file", "/home/user"); // false
 * ```
 */
function isHomeDotfile(
  resolved: string,
  home: string,
): boolean {
  if (!isUnder(
    resolved,
    home
  )) return false;
  const relative = resolved.slice(home.length).replace(
    /^\//,
    "",
  );
  const [first = ""] = relative.split("/");
  return first.startsWith(".");
}

export {
  isHomeDotfile,
  isUnder,
  pathSignals,
  resolvePath,
};
