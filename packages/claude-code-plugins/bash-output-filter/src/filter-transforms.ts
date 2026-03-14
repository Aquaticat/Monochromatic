/**
 * Transformation functions for the Bash output filter.
 *
 * Each function handles one transformation pass: stripping noise lines,
 * collapsing repeated characters, replacing absolute paths with relative
 * equivalents, truncating long lines, and deduplicating consecutive identical lines.
 *
 * @module
 */

import {
  ALT_CWD_PREFIX,
  CWD_PREFIX,
  DEDUP_THRESHOLD,
  GIT_FILE_MODE_PATTERN,
  GIT_TRANSPORT_PROGRESS_PATTERNS,
  HOME_DIR,
  MAX_LINE_LENGTH,
  MAX_REPEATED_CHARS,
  REAL_HOME_DIR,
  SANDBOX_NOISE_PATTERNS,
} from './filter-patterns.ts';

//region Line stripping

/**
 * Whether a line should be removed entirely.
 *
 * @param line - Trimmed line to check.
 *
 * @returns `true` if the line is noise that should be stripped.
 */
export function shouldStripLine(line: string): boolean {
  if (GIT_FILE_MODE_PATTERN.test(line)) {
    return true
  }
  if (SANDBOX_NOISE_PATTERNS.some(function patternTest(pattern) {
    return pattern.test(line)
  })) {
    return true
  }
  return GIT_TRANSPORT_PROGRESS_PATTERNS.some(function patternTest(pattern) {
    return pattern.test(line)
  })
}

//endregion

//region Character collapsing

/**
 * Collapses runs of repeated characters beyond {@link MAX_REPEATED_CHARS}.
 * Replaces `====...====` with `=== (x44)` to eliminate decorative separators
 * that waste tokens without conveying information.
 *
 * Only collapses runs of 10+ non-alphanumeric, non-whitespace characters
 * to avoid mangling real content (`aaaa`, `0000`) or short structural
 * runs like ASCII table borders (`+---------+` has 9 dashes).
 *
 * @param line - Line to process.
 *
 * @returns Line with long character runs collapsed.
 *
 * @example
 * ```ts
 * collapseRepeatedChars('===== Header =====')
 * // → '=== (x5) Header === (x5)'
 * ```
 */
export function collapseRepeatedChars(line: string): string {
  return line.replaceAll(
    /([^\w\s])\1{9,}/g,
    function collapseRun(match, char: string) {
      return `${char.repeat(MAX_REPEATED_CHARS)} (x${match.length})`
    },
  )
}

//endregion

//region Path collapsing

/**
 * Replaces working directory paths with relative equivalents.
 *
 * Strips the CWD prefix from absolute paths, converting them to relative paths.
 * This saves significant tokens when tools like `fd` or `rg` output the full
 * absolute path on every line -- the model already knows the search root from
 * the command.
 *
 * Handles both the `process.cwd()` path and its symlink-resolved real path.
 * The longer path is replaced first to avoid partial replacements.
 *
 * @param line - Line to process.
 *
 * @returns Line with CWD-prefixed paths converted to relative paths.
 *
 * @example
 * ```ts
 * // Given CWD=/home/user/project
 * collapseCwdPaths('/home/user/project/src/index.ts')
 * // → 'src/index.ts'
 * collapseCwdPaths('/var/home/user/project/packages/foo/bar.ts')
 * // → 'packages/foo/bar.ts'
 * ```
 */
export function collapseCwdPaths(line: string): string {
  if (CWD_PREFIX === '') {
    return line
  }

  /**
   * Replace the longer path first (same logic as {@link collapseHomePaths}).
   */
  let result = line
  if (ALT_CWD_PREFIX !== '') {
    if (ALT_CWD_PREFIX.length >= CWD_PREFIX.length) {
      result = result.replaceAll(ALT_CWD_PREFIX, '')
      result = result.replaceAll(CWD_PREFIX, '')
    } else {
      result = result.replaceAll(CWD_PREFIX, '')
      result = result.replaceAll(ALT_CWD_PREFIX, '')
    }
  } else {
    result = result.replaceAll(CWD_PREFIX, '')
  }
  return result
}

/**
 * Replaces home directory paths with `~` shorthand.
 *
 * Handles both the `$HOME` path and its real path (following symlinks),
 * since different tools resolve symlinks differently.
 * The longer path (real path) is replaced first to avoid partial matches
 * when one is a prefix of the other.
 *
 * @param line - Line to process.
 *
 * @returns Line with home directory paths collapsed to `~`.
 *
 * @example
 * ```ts
 * // Given HOME=/home/user, realpath=/var/home/user
 * collapseHomePaths('/var/home/user/projects/foo')
 * // → '~/projects/foo'
 * collapseHomePaths('/home/user/.config/bar')
 * // → '~/.config/bar'
 * ```
 */
export function collapseHomePaths(line: string): string {
  if (HOME_DIR === '') {
    return line
  }

  /**
   * Replace the longer path first.
   * If REAL_HOME_DIR is `/var/home/user` and HOME_DIR is `/home/user`,
   * replacing HOME_DIR first would leave `/var` prefixed remnants.
   */
  let result = line
  if (REAL_HOME_DIR !== '') {
    if (REAL_HOME_DIR.length >= HOME_DIR.length) {
      result = result.replaceAll(REAL_HOME_DIR, '~')
      result = result.replaceAll(HOME_DIR, '~')
    } else {
      result = result.replaceAll(HOME_DIR, '~')
      result = result.replaceAll(REAL_HOME_DIR, '~')
    }
  } else {
    result = result.replaceAll(HOME_DIR, '~')
  }
  return result
}

//endregion

//region Line truncation

/**
 * Truncates a line that exceeds {@link MAX_LINE_LENGTH}.
 *
 * @param line - Line to potentially truncate.
 *
 * @returns Original line if short enough, or truncated with a length marker.
 */
export function truncateLine(line: string): string {
  if (line.length <= MAX_LINE_LENGTH) {
    return line
  }
  return `${line.slice(0, MAX_LINE_LENGTH)}... [${line.length} chars]`
}

//endregion

//region Deduplication

/**
 * Appends a run of repeated lines to the result array.
 * Collapses runs of {@link DEDUP_THRESHOLD}+ identical lines to `line (xN)`.
 *
 * @param result - Accumulator array to push onto.
 *
 * @param line - The repeated line content.
 *
 * @param count - How many consecutive times `line` appeared.
 */
export function flushRepeated({
  result,
  line,
  count,
}: {
  result: string[];
  line: string;
  count: number;
}): void {
  if (count === 0) {
    return
  }
  if (count >= DEDUP_THRESHOLD) {
    result.push(`${line} (x${count})`)
  } else {
    for (let i = 0; i < count; i++) {
      result.push(line)
    }
  }
}

//endregion
