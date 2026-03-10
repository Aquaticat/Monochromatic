#!/usr/bin/env bun

/**
 * Stdin filter that strips wasteful patterns from Bash tool output before the model sees it.
 *
 * Runs inside the sandbox as the right side of a pipe.
 * On any error, passes through the original input unchanged to avoid breaking tool output.
 *
 * Transformations applied (ranked by token savings):
 * - Git commit/push/pull boilerplate (`create mode`, progress counters)
 * - Long line truncation (>500 chars, catches minified JS)
 * - Consecutive duplicate line collapsing (3+ identical lines → `line (xN)`)
 * - Repeated character collapsing (`====...====` → `=== (x44)`)
 * - Working directory path collapsing (`/var/home/user/project/...` → `...`)
 * - Home directory path collapsing (`/var/home/user/...` → `~/...`)
 * - Trailing whitespace removal
 *
 * @example
 * ```bash
 * git commit -m "feat: add feature" 2>&1 | bun filter.ts
 * ```
 *
 * @module
 */

import { realpathSync } from 'node:fs';

export {}

//region Constants

/** Lines beyond this length are truncated with an ellipsis marker. */
const MAX_LINE_LENGTH = 500

/** Minimum consecutive identical lines before collapsing to `(xN)` notation. */
const DEDUP_THRESHOLD = 3

/**
 * Maximum consecutive repetitions of a single character before collapsing.
 * Set high enough to preserve ASCII table borders (`+---------+` is 9 dashes)
 * while catching decorative separators (`====...====` is typically 40+).
 *
 * @example
 * ```
 * "============================================" → "=== (x44)"
 * "+---------+---------+"                       → unchanged (9 < threshold)
 * ```
 */
const MAX_REPEATED_CHARS = 3

/**
 * Resolved absolute path to the user's home directory.
 * On systems where `$HOME` is a symlink (e.g. `/home/user` → `/var/home/user`),
 * the real path differs from `$HOME`. Both forms appear in tool output
 * (`fd` uses the real path, `rg` may use either), so both must be collapsed.
 *
 * Falls back to empty string if `$HOME` is unset, which disables path collapsing
 * without breaking the filter.
 */
const HOME_DIR = process.env['HOME'] ?? ''

/**
 * Canonical (real) path to the home directory, following symlinks.
 * Resolved synchronously at startup via `fs.realpathSync`.
 *
 * On Fedora Atomic (Silverblue/Kinoite), `/home` is a symlink to `/var/home`,
 * so `$HOME=/home/user` but the real path is `/var/home/user`.
 * Tools like `fd` output the real path while `$HOME` gives the symlink path.
 *
 * @example
 * ```
 * HOME_DIR      = "/home/user"
 * REAL_HOME_DIR = "/var/home/user"
 * ```
 */
const REAL_HOME_DIR = (() => {
  try {
    if (HOME_DIR === '') {
      return ''
    }
    /* eslint-disable-next-line n/no-sync -- one-shot startup cost, avoids async complexity in a filter script */
    const resolved = realpathSync(HOME_DIR)
    return resolved === HOME_DIR ? '' : resolved
  } catch {
    return ''
  }
})()

/**
 * Current working directory with trailing slash.
 * The filter inherits the piped command's cwd, which matches the sandbox's tracked cwd.
 *
 * Used to convert absolute paths in tool output (e.g. `fd`, `rg`) to relative paths.
 * The trailing slash ensures only directory prefixes are matched, not partial names
 * (e.g. `/home/user/project` should not match `/home/user/project-old/file`).
 *
 * @example
 * ```
 * CWD_PREFIX     = "/home/user/project/"
 * "/home/user/project/src/index.ts" → "src/index.ts"
 * ```
 */
const CWD_PREFIX = (() => {
  try {
    const cwd = process.cwd()
    return cwd.endsWith('/') ? cwd : `${cwd}/`
  } catch {
    return ''
  }
})()

/**
 * Alternate CWD prefix using the other home directory form.
 *
 * `process.cwd()` returns the real path (e.g. `/var/home/user/project`),
 * but some tool output uses the `$HOME` symlink form (e.g. `/home/user/project`).
 * This computes the alternate form by swapping the home directory prefix.
 *
 * @example
 * ```
 * CWD_PREFIX     = "/var/home/user/project/"  (real path from process.cwd())
 * ALT_CWD_PREFIX = "/home/user/project/"      (symlink form via $HOME)
 * ```
 */
const ALT_CWD_PREFIX = (() => {
  if (CWD_PREFIX === '' || REAL_HOME_DIR === '' || HOME_DIR === '') {
    return ''
  }

  /**
   * `process.cwd()` typically returns the real path.
   * If CWD starts with REAL_HOME_DIR, the alternate form uses HOME_DIR.
   * If CWD starts with HOME_DIR, the alternate form uses REAL_HOME_DIR.
   */
  if (CWD_PREFIX.startsWith(`${REAL_HOME_DIR}/`)) {
    return `${HOME_DIR}${CWD_PREFIX.slice(REAL_HOME_DIR.length)}`
  }
  if (CWD_PREFIX.startsWith(`${HOME_DIR}/`)) {
    return `${REAL_HOME_DIR}${CWD_PREFIX.slice(HOME_DIR.length)}`
  }
  return ''
})()

//endregion

//region Git boilerplate patterns

/**
 * Patterns matching git commit per-file mode lines.
 * These repeat once per file and carry no information the model needs.
 *
 * @example
 * ```
 *  create mode 100644 packages/foo/src/index.ts
 *  delete mode 100644 packages/bar/old-file.ts
 *  rename packages/{old => new}/file.ts (95%)
 *  copy packages/{src => dest}/file.ts (100%)
 *  mode change 100644 => 100755 scripts/run.sh
 * ```
 */
const GIT_FILE_MODE_PATTERN = /^ (create|delete|copy|rename|mode change) mode /

/**
 * Patterns matching git transport progress lines from push/pull/fetch/clone.
 * These are ephemeral counters (e.g., "Counting objects: 42% (10/24)") that
 * provide no value in the transcript.
 *
 * @example
 * ```
 * Enumerating objects: 42, done.
 * Counting objects: 100% (42/42), done.
 * Delta compression using up to 8 threads
 * Compressing objects: 100% (20/20), done.
 * Writing objects: 100% (22/22), 5.43 KiB | 2.71 MiB/s, done.
 * Total 22 (delta 15), reused 0 (delta 0), pack-reused 0
 * Resolving deltas: 100% (15/15), completed with 10 local objects.
 * Unpacking objects: 100% (22/22), 5.43 KiB | 271.00 KiB/s, done.
 * remote: Resolving deltas: 100% (15/15), completed with 10 local objects.
 * ```
 */
const GIT_TRANSPORT_PROGRESS_PATTERNS = [
  /^Enumerating objects:/,
  /^Counting objects:/,
  /^Compressing objects:/,
  /^Delta compression/,
  /^Writing objects:/,
  /^Total \d+/,
  /^Resolving deltas:/,
  /^Unpacking objects:/,
  /^remote: (Enumerating|Counting|Compressing|Resolving|Writing|Total|Unpacking)/,
]

//endregion

//region Sandbox noise patterns

/**
 * Patterns matching sandbox environment noise that provides no value to the model.
 *
 * These lines are artifacts of running inside the Claude Code sandbox and are
 * not part of the command's actual output.
 */
const SANDBOX_NOISE_PATTERNS = [
  /**
   * Mise cache write failures caused by the sandbox's read-only filesystem.
   * These appear on nearly every mise invocation and repeat per tool version,
   * producing dozens of identical warning lines.
   *
   * @example
   * ```
   * mise WARN  failed to write cache file: ~/.cache/mise/neovim/0.11.6/exec_env_....msgpack.z Read-only file system (os error 30)
   * mise WARN  failed to write cache file: ~/.cache/mise/ripgrep/15.1.0/bin_paths-....msgpack.z Read-only file system (os error 30)
   * ```
   */
  /^mise WARN\s+failed to write cache file:.*Read-only file system/,
]

//endregion

//region Filter logic

/**
 * Whether a line should be removed entirely.
 *
 * @param line - Trimmed line to check.
 * @returns `true` if the line is noise that should be stripped.
 */
function shouldStripLine(line: string): boolean {
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
 * @returns Line with long character runs collapsed.
 *
 * @example
 * ```ts
 * collapseRepeatedChars('===== Header =====')
 * // → '=== (x5) Header === (x5)'
 * ```
 */
function collapseRepeatedChars(line: string): string {
  return line.replaceAll(
    /([^\w\s])\1{9,}/g,
    function collapseRun(match, char: string) {
      return `${char.repeat(MAX_REPEATED_CHARS)} (x${match.length})`
    },
  )
}

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
function collapseCwdPaths(line: string): string {
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
function collapseHomePaths(line: string): string {
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

/**
 * Truncates a line that exceeds {@link MAX_LINE_LENGTH}.
 *
 * @param line - Line to potentially truncate.
 * @returns Original line if short enough, or truncated with a length marker.
 */
function truncateLine(line: string): string {
  if (line.length <= MAX_LINE_LENGTH) {
    return line
  }
  return `${line.slice(0, MAX_LINE_LENGTH)}... [${line.length} chars]`
}

/**
 * Appends a run of repeated lines to the result array.
 * Collapses runs of {@link DEDUP_THRESHOLD}+ identical lines to `line (xN)`.
 *
 * @param result - Accumulator array to push onto.
 * @param line - The repeated line content.
 * @param count - How many consecutive times `line` appeared.
 */
function flushRepeated({
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

/**
 * Applies all filter transformations to raw tool output.
 *
 * @param input - Raw stdout/stderr text from the Bash tool.
 * @returns Filtered text with boilerplate, long lines, duplicates, and trailing whitespace removed.
 */
function filterOutput(input: string): string {
  const lines = input.split('\n')
  const result: string[] = []

  let prevLine = ''
  let repeatCount = 0

  for (const rawLine of lines) {
    /** Line with trailing whitespace removed. */
    const trimmed = rawLine.trimEnd()

    if (shouldStripLine(trimmed)) {
      continue
    }

    /** Line after collapsing repeated decorative characters. */
    const collapsed = collapseRepeatedChars(trimmed)

    /** Line after stripping the working directory prefix from absolute paths. */
    const relative = collapseCwdPaths(collapsed)

    /** Line after replacing home directory paths with `~`. */
    const shortened = collapseHomePaths(relative)

    /** Line after length truncation. */
    const processed = truncateLine(shortened)

    if (processed === prevLine && repeatCount > 0) {
      repeatCount++
    } else {
      flushRepeated({ result, line: prevLine, count: repeatCount })
      prevLine = processed
      repeatCount = 1
    }
  }

  flushRepeated({ result, line: prevLine, count: repeatCount })

  return result.join('\n')
}

//endregion

//region Main

try {
  /** Raw text read from stdin (piped from the Bash tool command). */
  const input = await Bun.stdin.text()

  /** Filtered output with waste patterns removed. */
  const filtered = filterOutput(input)

  process.stdout.write(filtered)
} catch {
  /**
   * On any error, read and pass through whatever we can.
   * Losing output is worse than failing to filter.
   */
  try {
    const fallback = await Bun.stdin.text()
    process.stdout.write(fallback)
  } catch {
    /* stdin already consumed or unavailable -- nothing to pass through */
  }
}

//endregion
