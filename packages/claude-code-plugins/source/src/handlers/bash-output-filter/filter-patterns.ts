/**
 * Constants and pattern definitions for the Bash output filter.
 *
 * Contains threshold values, resolved path constants, and regex patterns
 * that identify noise lines to strip from tool output.
 *
 * @module
 */

import { realpathSync, } from 'node:fs';

//region Constants

/** Lines beyond this length are truncated with an ellipsis marker. */
const MAX_LINE_LENGTH = 500;

/** Minimum consecutive identical lines before collapsing to `(xN)` notation. */
const DEDUP_THRESHOLD = 3;

/**
 * Maximum consecutive repetitions of a single character before collapsing.
 * Set high enough to preserve ASCII table borders (`+---------+` is 9 dashes)
 * while catching decorative separators (`====...====` is typically 40+).
 */
const MAX_REPEATED_CHARS = 3;

/**
 * Resolved absolute path to the user's home directory. Falls back to empty
 * string if `$HOME` is unset, which disables path collapsing without breaking
 * the filter.
 */
const HOME_DIR: string = process.env['HOME'] ?? '';

/**
 * Canonical (real) path to the home directory, following symlinks. Resolved
 * synchronously at startup via `fs.realpathSync`. On Fedora Atomic, `/home`
 * is a symlink to `/var/home`, so `$HOME=/home/user` but the real path is
 * `/var/home/user`. Tools differ on which form they emit.
 */
const REAL_HOME_DIR: string = (function resolveRealHome(): string {
  try {
    if (HOME_DIR === '')
      return '';
    /* oxlint-disable-next-line node/no-sync -- one-shot startup cost, avoids async complexity in a filter script */
    const resolved = realpathSync(HOME_DIR,);
    return resolved === HOME_DIR ? '' : resolved;
  }
  catch {
    return '';
  }
})();

/**
 * Current working directory with trailing slash. The filter inherits the piped
 * command's cwd, which matches the sandbox's tracked cwd. Used to convert
 * absolute paths in tool output to relative paths.
 */
const CWD_PREFIX: string = (function resolveCwdPrefix(): string {
  try {
    const cwd = process.cwd();
    return cwd.endsWith('/',) ? cwd : `${cwd}/`;
  }
  catch {
    return '';
  }
})();

/**
 * Alternate CWD prefix using the other home directory form. `process.cwd()`
 * returns the real path, but some tool output uses the `$HOME` symlink form;
 * this computes the alternate by swapping the home-directory prefix.
 */
const ALT_CWD_PREFIX: string = (function resolveAltCwdPrefix(): string {
  if (CWD_PREFIX === '' || REAL_HOME_DIR === '' || HOME_DIR === '')
    return '';

  if (CWD_PREFIX.startsWith(`${REAL_HOME_DIR}/`,))
    return `${HOME_DIR}${CWD_PREFIX.slice(REAL_HOME_DIR.length,)}`;
  if (CWD_PREFIX.startsWith(`${HOME_DIR}/`,))
    return `${REAL_HOME_DIR}${CWD_PREFIX.slice(HOME_DIR.length,)}`;
  return '';
})();

//endregion

//region Git boilerplate patterns

/**
 * Patterns matching git commit per-file mode lines. These repeat once per file
 * and carry no information the model needs.
 */
const GIT_FILE_MODE_PATTERN: RegExp =
  /^ (create|delete|copy|rename|mode change) mode /;

/**
 * Patterns matching git transport progress lines from push/pull/fetch/clone.
 * These are ephemeral counters that provide no value in the transcript.
 */
const GIT_TRANSPORT_PROGRESS_PATTERNS: readonly RegExp[] = [
  /^Enumerating objects:/,
  /^Counting objects:/,
  /^Compressing objects:/,
  /^Delta compression/,
  /^Writing objects:/,
  /^Total \d+/,
  /^Resolving deltas:/,
  /^Unpacking objects:/,
  /^remote: (Enumerating|Counting|Compressing|Resolving|Writing|Total|Unpacking)/,
];

//endregion

//region Sandbox noise patterns

/**
 * Patterns matching sandbox environment noise that provides no value to the
 * model. These lines are artifacts of running inside the Claude Code sandbox.
 */
const SANDBOX_NOISE_PATTERNS: readonly RegExp[] = [
  /^\s*(\[.*?\]\s+)?mise WARN\s+failed to write cache file:.*Read-only file system/,
];

//endregion

export {
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
};
