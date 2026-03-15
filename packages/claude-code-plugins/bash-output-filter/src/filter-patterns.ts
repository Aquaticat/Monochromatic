/**
 * Constants and pattern definitions for the Bash output filter.
 *
 * Extracted from `filter.ts` to keep each source file under 100 countable lines.
 * Contains threshold values, resolved path constants, and regex patterns
 * that identify noise lines to strip from tool output.
 *
 * @module
 */

import { realpathSync } from 'node:fs';

//region Constants

/** Lines beyond this length are truncated with an ellipsis marker. */
export const MAX_LINE_LENGTH = 500

/** Minimum consecutive identical lines before collapsing to `(xN)` notation. */
export const DEDUP_THRESHOLD = 3

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
export const MAX_REPEATED_CHARS = 3

/**
 * Resolved absolute path to the user's home directory.
 * On systems where `$HOME` is a symlink (e.g. `/home/user` → `/var/home/user`),
 * the real path differs from `$HOME`. Both forms appear in tool output
 * (`fd` uses the real path, `rg` may use either), so both must be collapsed.
 *
 * Falls back to empty string if `$HOME` is unset, which disables path collapsing
 * without breaking the filter.
 */
export const HOME_DIR = process.env['HOME'] ?? ''

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
export const REAL_HOME_DIR = (function resolveRealHome(): string {
  try {
    if (HOME_DIR === '') {
      return ''
    }
    /* oxlint-disable-next-line node/no-sync -- one-shot startup cost, avoids async complexity in a filter script */
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
export const CWD_PREFIX = (function resolveCwdPrefix(): string {
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
export const ALT_CWD_PREFIX = (function resolveAltCwdPrefix(): string {
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
export const GIT_FILE_MODE_PATTERN = /^ (create|delete|copy|rename|mode change) mode /

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
export const GIT_TRANSPORT_PROGRESS_PATTERNS = [
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
export const SANDBOX_NOISE_PATTERNS = [
  /**
   * Mise cache write failures caused by the sandbox's read-only filesystem.
   * These appear on nearly every mise invocation and repeat per tool version,
   * producing dozens of identical warning lines.
   *
   * When commands run via `mise run //packages/path:task`, mise prefixes each
   * output line with the task label (e.g. `[//packages/build-tool/css:lint]`),
   * so the pattern must allow optional leading whitespace and a bracketed prefix.
   *
   * @example
   * ```
   * mise WARN  failed to write cache file: ~/.cache/mise/neovim/0.11.6/exec_env_....msgpack.z Read-only file system (os error 30)
   * mise WARN  failed to write cache file: ~/.cache/mise/ripgrep/15.1.0/bin_paths-....msgpack.z Read-only file system (os error 30)
   *      [//packages/build-tool/css:lint] mise WARN  failed to write cache file: ~/.cache/mise/neovim/0.11.6/exec_env_....msgpack.z Read-only file system (os error 30)
   * ```
   */
  /^\s*(\[.*?\]\s+)?mise WARN\s+failed to write cache file:.*Read-only file system/,
]

//endregion
