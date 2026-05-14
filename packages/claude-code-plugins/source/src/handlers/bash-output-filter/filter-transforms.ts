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
 * @param line - trimmed line to check
 *
 * @returns `true` if the line is noise that should be stripped
 *
 * @example
 * ```ts
 * shouldStripLine('100644'); // true (git file mode noise)
 * shouldStripLine('hello world'); // false
 * ```
 */
function shouldStripLine(line: string,): boolean {
  if (GIT_FILE_MODE_PATTERN.test(line,))
    return true;
  if (SANDBOX_NOISE_PATTERNS.some(function patternTest(pattern,) {
    return pattern.test(line,);
  },)) {
    return true;
  }
  return GIT_TRANSPORT_PROGRESS_PATTERNS.some(function patternTest(pattern,) {
    return pattern.test(line,);
  },);
}

//endregion

//region Character collapsing

/**
 * Collapses runs of repeated characters beyond {@link MAX_REPEATED_CHARS}.
 * Only collapses runs of 10+ non-alphanumeric, non-whitespace characters.
 *
 * @param line - line to process
 *
 * @returns line with long character runs collapsed
 *
 * @example
 * ```ts
 * collapseRepeatedChars('====================');
 * // '==== (x20)'
 * ```
 */
function collapseRepeatedChars(line: string,): string {
  return line.replaceAll(
    /([^\w\s])\1{9,}/g,
    function collapseRun(
      match,
      char: string,
    ) {
      return `${char.repeat(MAX_REPEATED_CHARS,)} (x${match.length})`;
    },
  );
}

//endregion

//region Path collapsing

/**
 * Replaces working-directory paths with relative equivalents, only when the
 * path appears at the beginning of a line. Restricts replacement to line-initial
 * position to avoid mangling paths embedded in error messages or JSON.
 *
 * @param line - line to process
 *
 * @returns line with CWD-prefixed start converted to a relative path
 *
 * @example
 * ```ts
 * // CWD = '/repo'
 * collapseCwdPaths('/repo/src/index.ts'); // 'src/index.ts'
 * collapseCwdPaths('error at /repo/x'); // unchanged (not at start)
 * ```
 */
function collapseCwdPaths(line: string,): string {
  if (CWD_PREFIX === '')
    return line;

  if (ALT_CWD_PREFIX !== '') {
    if (ALT_CWD_PREFIX.length >= CWD_PREFIX.length) {
      if (line.startsWith(ALT_CWD_PREFIX,))
        return line.slice(ALT_CWD_PREFIX.length,);
      if (line.startsWith(CWD_PREFIX,))
        return line.slice(CWD_PREFIX.length,);
    }
    else {
      if (line.startsWith(CWD_PREFIX,))
        return line.slice(CWD_PREFIX.length,);
      if (line.startsWith(ALT_CWD_PREFIX,))
        return line.slice(ALT_CWD_PREFIX.length,);
    }
  }
  else if (line.startsWith(CWD_PREFIX,)) {
    return line.slice(CWD_PREFIX.length,);
  }
  return line;
}

/**
 * Replaces home directory paths with `~` shorthand, only at line start.
 * Handles both `$HOME` path and its real (symlink-resolved) path.
 *
 * @param line - line to process
 *
 * @returns line with home directory path collapsed to `~` if at start
 *
 * @example
 * ```ts
 * // HOME = '/home/alice'
 * collapseHomePaths('/home/alice/notes.md'); // '~/notes.md'
 * ```
 */
function collapseHomePaths(line: string,): string {
  if (HOME_DIR === '')
    return line;

  if (REAL_HOME_DIR !== '') {
    if (REAL_HOME_DIR.length >= HOME_DIR.length) {
      if (line.startsWith(REAL_HOME_DIR,))
        return `~${line.slice(REAL_HOME_DIR.length,)}`;
      if (line.startsWith(HOME_DIR,))
        return `~${line.slice(HOME_DIR.length,)}`;
    }
    else {
      if (line.startsWith(HOME_DIR,))
        return `~${line.slice(HOME_DIR.length,)}`;
      if (line.startsWith(REAL_HOME_DIR,))
        return `~${line.slice(REAL_HOME_DIR.length,)}`;
    }
  }
  else if (line.startsWith(HOME_DIR,)) {
    return `~${line.slice(HOME_DIR.length,)}`;
  }
  return line;
}

//endregion

//region Line truncation

/**
 * Truncates a line that exceeds {@link MAX_LINE_LENGTH}, appending a length marker.
 *
 * @param line - line to potentially truncate
 *
 * @returns original line if short enough, or truncated with a length marker
 *
 * @example
 * ```ts
 * truncateLine('x'.repeat(800)); // truncates with `... [800 chars]`
 * ```
 */
function truncateLine(line: string,): string {
  if (line.length <= MAX_LINE_LENGTH)
    return line;
  return `${
    line.slice(
      0,
      MAX_LINE_LENGTH,
    )
  }... [${line.length} chars]`;
}

//endregion

//region Deduplication

/**
 * Appends a run of repeated lines to the result array. Collapses runs of
 * {@link DEDUP_THRESHOLD}+ identical lines to `line (xN)`.
 *
 * @param result - accumulator array to push onto
 *
 * @param line - repeated line content
 *
 * @param count - how many consecutive times `line` appeared
 *
 * @example
 * ```ts
 * const out: string[] = [];
 * flushRepeated({ result: out, line: 'foo', count: 5, },); // out: ['foo (x5)']
 * ```
 */
function flushRepeated(
  {
    result,
    line,
    count,
  }: {
    result: string[];
    line: string;
    count: number;
  },
): void {
  if (count === 0)
    return;
  if (count >= DEDUP_THRESHOLD)
    result.push(`${line} (x${count})`,);
  else {
    for (let i = 0; i < count; i++)
      result.push(line,);
  }
}

//endregion

export {
  collapseCwdPaths,
  collapseHomePaths,
  collapseRepeatedChars,
  flushRepeated,
  shouldStripLine,
  truncateLine,
};
