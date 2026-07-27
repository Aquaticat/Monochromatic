/**
 * Path normalization shared by directory containment and glob matching.
 *
 * Every path this plugin compares is first resolved and then rewritten with `/`
 * separators, so one pattern spelling and one containment test work regardless
 * of host separator. Resolution is purely lexical: nothing is read from disk,
 * which is what keeps diagnostics identical whether or not a build has run.
 *
 * @module
 */

import {
  resolve,
  sep,
} from 'node:path';

/**
 * Separator that normalized paths use.
 */
const POSIX_SEPARATOR = '/';

/**
 * Rewrites host separators as `/`.
 *
 * @param path - already-resolved absolute path
 *
 * @returns same path with `/` separators
 *
 * @example
 * ```ts
 * toPosixPath({ path: 'C:\\repo\\src' });
 * ```
 *
 * @internal
 */
export function toPosixPath({ path, }: {
  /**
   * Already-resolved absolute path to normalize.
   */
  readonly path: string;
},): string {
  return sep === POSIX_SEPARATOR
    ? path
    : path.split(sep,)
      .join(POSIX_SEPARATOR,);
}

/**
 * Resolves a specifier against a base directory without touching the file system.
 *
 * Skipping existence checks and extension probing is deliberate: a `.js`
 * specifier naming a not-yet-built artifact must classify the same way before
 * and after a build.
 *
 * @param base - directory the specifier is relative to
 *
 * @param specifier - relative specifier from an import declaration
 *
 * @returns normalized absolute path
 *
 * @example
 * ```ts
 * resolvePosix({ base: '/repo/src', specifier: '../dist/final/node/index.mjs' });
 * ```
 *
 * @internal
 */
export function resolvePosix({
  base,
  specifier,
}: {
  /**
   * Directory the specifier is relative to.
   */
  readonly base: string;
  /**
   * Relative specifier from an import declaration.
   */
  readonly specifier: string;
},): string {
  return toPosixPath({
    path: resolve(
      base,
      specifier,
    ),
  },);
}

/**
 * Tests whether a normalized path is the given directory or sits beneath it.
 *
 * Comparing against `directory + '/'` rather than a bare prefix keeps
 * `/repo/dist-extra` from counting as being under `/repo/dist`.
 *
 * @param directory - normalized absolute directory
 *
 * @param path - normalized absolute path to test
 *
 * @returns true when path is directory itself or lies beneath it
 *
 * @example
 * ```ts
 * isUnderDirectory({ directory: '/repo/dist/final', path: '/repo/dist/final/node/index.mjs' });
 * ```
 *
 * @internal
 */
export function isUnderDirectory({
  directory,
  path,
}: {
  /**
   * Normalized absolute directory to test containment against.
   */
  readonly directory: string;
  /**
   * Normalized absolute path to test.
   */
  readonly path: string;
},): boolean {
  if (path === directory)
    return true;
  return path.startsWith(`${directory}${POSIX_SEPARATOR}`,);
}

/**
 * Tests whether a normalized path sits under any of the given directories.
 *
 * @param directories - normalized absolute directories
 *
 * @param path - normalized absolute path to test
 *
 * @returns true when any directory contains path
 *
 * @example
 * ```ts
 * isUnderAnyDirectory({ directories: ['/repo/dist/final'], path: '/repo/dist/final/index.mjs' });
 * ```
 *
 * @internal
 */
export function isUnderAnyDirectory({
  directories,
  path,
}: {
  /**
   * Normalized absolute directories to test containment against.
   */
  readonly directories: readonly string[];
  /**
   * Normalized absolute path to test.
   */
  readonly path: string;
},): boolean {
  return directories.some(function contains(directory,): boolean {
    return isUnderDirectory({
      directory,
      path,
    },);
  },);
}
