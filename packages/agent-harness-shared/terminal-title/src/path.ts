/**
 * Smart path rendering for terminal titles.
 *
 * @module
 */

import {
  basename,
  isAbsolute,
  relative,
} from 'node:path';

//region Path constants

/**
 * Sentinel for absolute paths that cannot be displayed relative to cwd.
 */
const CWD_RELATIVE_PATH_MISSING: unique symbol = Symbol('terminal-title/cwd-relative-path-missing',);

/**
 * POSIX path separator accepted in tool payload paths.
 */
const POSIX_PATH_SEPARATOR: string = '/';

/**
 * Windows path separator accepted in tool payload paths.
 */
const WINDOWS_PATH_SEPARATOR: string = '\\';

/**
 * Relative parent path segment used to detect paths outside a supplied cwd.
 */
const PARENT_PATH_SEGMENT: string = '..';

/**
 * Dot-slash relative path prefix trimmed from title display.
 */
const CURRENT_DIRECTORY_PREFIX: string = './';

//endregion Path constants

//region Segment helpers

/**
 * Checks whether character is a path separator in common host payloads.
 *
 * @param character - because tool inputs may carry POSIX or Windows-looking paths
 *
 * @returns whether `character` separates path segments
 *
 * @example
 * ```ts
 * isPathSeparator('/');
 * // true
 * ```
 */
function isPathSeparator(character: string,): boolean {
  return (character === POSIX_PATH_SEPARATOR)
    || (character === WINDOWS_PATH_SEPARATOR);
}

/**
 * Splits path text into non-empty segments without regular expressions.
 *
 * @param filePath - because absolute fallback titles need tail context
 *
 * @returns non-empty path segments in source order
 *
 * @example
 * ```ts
 * pathSegments('/tmp/src/index.ts');
 * // ['tmp', 'src', 'index.ts']
 * ```
 */
function pathSegments(filePath: string,): readonly string[] {
  /**
   * Completed path segments.
   */
  const segments: string[] = [];
  /**
   * Current path segment characters.
   */
  const current: string[] = [];

  for (const character of filePath) {
    if (isPathSeparator(character,)) {
      if (current.length > 0) {
        segments.push(current.join('',),);
        current.length = 0;
      }
      continue;
    }
    current.push(character,);
  }

  if (current.length > 0)
    segments.push(current.join('',),);
  return segments;
}

/**
 * Joins path segments for display using a stable separator.
 *
 * @param segments - because source paths may mix host separators
 *
 * @returns title path text joined with `/`
 *
 * @example
 * ```ts
 * joinDisplayPath(['src', 'index.ts']);
 * // 'src/index.ts'
 * ```
 */
function joinDisplayPath(segments: readonly string[],): string {
  return segments.join(POSIX_PATH_SEPARATOR,);
}

/**
 * Returns the tail context for absolute paths when no cwd relationship is known.
 *
 * @param filePath - because absolute machine prefixes should not dominate titles
 *
 * @returns last path segments suitable for title display
 *
 * @example
 * ```ts
 * fallbackAbsolutePath('/home/user/src/index.ts');
 * // 'src/index.ts'
 * ```
 */
function fallbackAbsolutePath(filePath: string,): string {
  /**
   * Non-empty path segments from `filePath`.
   */
  const segments = pathSegments(filePath,);
  if (segments.length === 0)
    return filePath;
  if (segments.length === 1)
    return segments[0] ?? filePath;
  return joinDisplayPath(segments.slice(-2,),);
}

//endregion Segment helpers

//region Relative path helpers

/**
 * Removes trivial current-directory prefix from relative path text.
 *
 * @param filePath - because `./x` spends title budget without adding context
 *
 * @returns relative title path text
 *
 * @example
 * ```ts
 * trimCurrentDirectoryPrefix('./src/index.ts');
 * // 'src/index.ts'
 * ```
 */
function trimCurrentDirectoryPrefix(filePath: string,): string {
  if (filePath.startsWith(CURRENT_DIRECTORY_PREFIX,))
    return filePath.slice(CURRENT_DIRECTORY_PREFIX.length,);
  return filePath;
}

/**
 * Checks whether a relative path stays inside cwd.
 *
 * @param relativePath - because paths outside cwd should keep safer tail context
 *
 * @returns whether relative path does not climb above cwd
 *
 * @example
 * ```ts
 * isInsideCwdRelativePath('src/index.ts');
 * // true
 * ```
 */
function isInsideCwdRelativePath(relativePath: string,): boolean {
  if (relativePath === '')
    return true;
  if (isAbsolute(relativePath,))
    return false;
  if (relativePath === PARENT_PATH_SEGMENT)
    return false;
  return !relativePath.startsWith(`${PARENT_PATH_SEGMENT}${POSIX_PATH_SEPARATOR}`,);
}

/**
 * Attempts to display an absolute path relative to cwd.
 *
 * @param filePath - because host payload may carry an absolute path
 *
 * @param cwd - because host event cwd is the best local path anchor
 *
 * @returns cwd-relative path when `filePath` is inside cwd, otherwise undefined
 *
 * @example
 * ```ts
 * relativePathFromCwd({ filePath: '/repo/src/index.ts', cwd: '/repo' });
 * // 'src/index.ts'
 * ```
 */
function relativePathFromCwd(
  {
    filePath,
    cwd,
  }: Readonly<{
    filePath: string;
    cwd: string;
  }>,
): string | typeof CWD_RELATIVE_PATH_MISSING {
  /**
   * Node-computed relative path from cwd to file path.
   */
  const relativePath = relative(
    cwd,
    filePath,
  );
  if (!isInsideCwdRelativePath(relativePath,))
    return CWD_RELATIVE_PATH_MISSING;
  if (relativePath === '')
    return basename(filePath,);
  return trimCurrentDirectoryPrefix(relativePath,);
}

//endregion Relative path helpers

//region Public path API

/**
 * Formats a path with cwd-relative context when possible and tail context otherwise.
 *
 * @param filePath - because tool payloads carry paths as display-relevant fields
 *
 * @param cwd - because host events may expose current working directory
 *
 * @returns smart relative title path text
 *
 * @example
 * ```ts
 * terminalTitlePath({ filePath: '/repo/src/index.ts', cwd: '/repo' });
 * // 'src/index.ts'
 * ```
 */
function terminalTitlePath(
  {
    filePath,
    cwd,
  }: Readonly<{
    filePath: string;
    cwd?: string;
  }>,
): string {
  if (!isAbsolute(filePath,))
    return trimCurrentDirectoryPrefix(filePath,);
  if (cwd !== undefined) {
    /**
     * Cwd-relative title path when `filePath` belongs to cwd.
     */
    const cwdRelativePath = relativePathFromCwd({
      filePath,
      cwd,
    },);
    if (((typeof cwdRelativePath) === 'string'))
      return cwdRelativePath;
  }
  return fallbackAbsolutePath(filePath,);
}

//endregion Public path API

export { terminalTitlePath, };
