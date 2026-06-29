/**
 * Constants and pattern predicates for the Bash output filter.
 *
 * Contains threshold values, resolved path constants, and named predicates
 * that identify noise lines to strip from tool output. Predicates replace
 * the previous regex arrays so the filter stays out of the
 * `no-restricted-syntax/no-regex` rule.
 *
 * @module
 */

import { realpath, } from 'node:fs/promises';

import {
  isDigit,
  isWhitespace,
} from '../../lib/text-scan.ts';

//region Constants

/**
 * Lines beyond this length are truncated with an ellipsis marker.
 */
const MAX_LINE_LENGTH = 500;

/**
 * Minimum consecutive identical lines before collapsing to `(xN)` notation.
 */
const DEDUP_THRESHOLD = 3;

/**
 * Maximum consecutive repetitions of a single character before collapsing.
 * Set high enough to preserve ASCII table borders (`+---------+` is 9 dashes)
 * while catching decorative separators (`====...====` is typically 40+).
 */
const MAX_REPEATED_CHARS = 3;

/**
 * Sentinel for path prefixes that are unavailable in the current environment.
 * A unique symbol avoids using an empty string as an out-of-band value.
 */
const PATH_PREFIX_ABSENT: unique symbol = Symbol('bash-output-filter/path-prefix-absent',);

/**
 * Path prefix used by path-collapsing transforms, or {@link PATH_PREFIX_ABSENT}
 * when no safe prefix is available.
 */
type PathPrefix = string | typeof PATH_PREFIX_ABSENT;

/**
 * Resolved absolute path to the user's home directory. Missing `$HOME` disables
 * home-path collapsing via the explicit sentinel.
 */
const HOME_DIR: PathPrefix = process.env
  .HOME
  ?? PATH_PREFIX_ABSENT;

/**
 * Adds a trailing slash to a directory path when absent.
 *
 * @param path - directory path to normalize
 *
 * @returns path with a trailing slash
 */
function withTrailingSlash(path: string,): string {
  return path.endsWith('/',) ? path : `${path}/`;
}

/**
 * Resolves the canonical home directory path, following symlinks. On Fedora
 * Atomic, `/home` is a symlink to `/var/home`, so `$HOME=/home/user` while the
 * real path is `/var/home/user`. Tools differ on which form they emit.
 *
 * @returns alternate real home path, or {@link PATH_PREFIX_ABSENT} when absent
 */
async function resolveRealHome(): Promise<PathPrefix> {
  if (HOME_DIR === PATH_PREFIX_ABSENT)
    return PATH_PREFIX_ABSENT;
  try {
    /**
     * Canonical home path resolved through filesystem metadata.
     */
    const resolved = await realpath(HOME_DIR,);
    return resolved === HOME_DIR ? PATH_PREFIX_ABSENT : resolved;
  }
  catch (_error: unknown) {
    return PATH_PREFIX_ABSENT;
  }
}

/**
 * Canonical (real) path to the home directory, following symlinks.
 */
const REAL_HOME_DIR: PathPrefix = await resolveRealHome();

/**
 * Resolves current working directory with a trailing slash.
 *
 * @returns cwd prefix, or {@link PATH_PREFIX_ABSENT} when cwd cannot be read
 */
function resolveCwdPrefix(): PathPrefix {
  try {
    /**
     * Current working directory before normalisation.
     */
    const cwd = process.cwd();
    return withTrailingSlash(cwd,);
  }
  catch (_error: unknown) {
    return PATH_PREFIX_ABSENT;
  }
}

/**
 * Current working directory with trailing slash. The filter inherits the piped
 * command's cwd, which matches the sandbox's tracked cwd. Used to convert
 * absolute paths in tool output to relative paths.
 */
const CWD_PREFIX: PathPrefix = resolveCwdPrefix();

/**
 * Alternate CWD prefix using the other home directory form. `process.cwd()`
 * returns the real path, but some tool output uses the `$HOME` symlink form;
 * this computes the alternate by swapping the home-directory prefix.
 *
 * @returns alternate cwd prefix, or {@link PATH_PREFIX_ABSENT} when unavailable
 */
function resolveAltCwdPrefix(): PathPrefix {
  if ((CWD_PREFIX === PATH_PREFIX_ABSENT) || (REAL_HOME_DIR === PATH_PREFIX_ABSENT)
    || (HOME_DIR === PATH_PREFIX_ABSENT))
    return PATH_PREFIX_ABSENT;

  if (CWD_PREFIX.startsWith(`${REAL_HOME_DIR}/`,))
    return `${HOME_DIR}${CWD_PREFIX.slice(REAL_HOME_DIR.length,)}`;
  if (CWD_PREFIX.startsWith(`${HOME_DIR}/`,))
    return `${REAL_HOME_DIR}${CWD_PREFIX.slice(HOME_DIR.length,)}`;
  return PATH_PREFIX_ABSENT;
}

/**
 * Alternate CWD prefix using the other home directory form.
 */
const ALT_CWD_PREFIX: PathPrefix = resolveAltCwdPrefix();

//endregion

//region Git boilerplate predicates

/**
 * Git verbs that introduce the per-file mode noise lines.
 */
const GIT_FILE_MODE_VERBS: readonly string[] = [
  'create',
  'delete',
  'copy',
  'rename',
  'mode change',
];

/**
 * Whether `line` is a git per-file mode line (`/^ (create|delete|copy|rename|mode change) mode /`).
 * These repeat once per file and carry no information the model needs.
 *
 * @param line - candidate output line
 *
 * @returns whether the line is a git per-file mode boilerplate
 *
 * @example
 * ```ts
 * isGitFileModeLine(' create mode 100644 foo.ts'); // true
 * isGitFileModeLine('hello world');                // false
 * ```
 */
function isGitFileModeLine(line: string,): boolean {
  return GIT_FILE_MODE_VERBS.some(function matchesVerb(verb,): boolean {
    return line.startsWith(` ${verb} mode `,);
  },);
}

/**
 * Literal prefixes for git transport progress lines whose presence alone identifies the noise.
 */
const GIT_TRANSPORT_PROGRESS_PREFIXES: readonly string[] = [
  'Enumerating objects:',
  'Counting objects:',
  'Compressing objects:',
  'Delta compression',
  'Writing objects:',
  'Resolving deltas:',
  'Unpacking objects:',
];

/**
 * Whether `line` begins with one of the literal git transport-progress prefixes.
 *
 * @param line - candidate output line
 *
 * @returns whether the line starts with a known progress prefix
 *
 * @example
 * ```ts
 * hasGitTransportPrefix('Counting objects: 100% (4/4)'); // true
 * ```
 */
function hasGitTransportPrefix(line: string,): boolean {
  return GIT_TRANSPORT_PROGRESS_PREFIXES.some(
    function startsWithPrefix(prefix,): boolean {
      return line.startsWith(prefix,);
    },
  );
}

/**
 * Literal prefix for git `Total <N>` summary lines whose first character after the space must be a digit.
 */
const TOTAL_PROGRESS_PREFIX = 'Total ';

/**
 * Whether `line` is a git `Total <count>` progress summary (`/^Total \d+/`).
 *
 * @param line - candidate output line
 *
 * @returns whether the line starts with `Total ` and a digit
 *
 * @example
 * ```ts
 * isTotalProgressLine('Total 1234'); // true
 * isTotalProgressLine('Total foo');  // false
 * ```
 */
function isTotalProgressLine(line: string,): boolean {
  if (!line.startsWith(TOTAL_PROGRESS_PREFIX,))
    return false;
  return isDigit(line.charAt(TOTAL_PROGRESS_PREFIX.length,),);
}

/**
 * Literal prefix for git's `remote: ...` progress lines emitted by the server.
 */
const REMOTE_PROGRESS_PREFIX = 'remote: ';

/**
 * Recognised verbs that follow `remote: ` for transport-progress noise.
 */
const REMOTE_PROGRESS_VERBS: readonly string[] = [
  'Enumerating',
  'Counting',
  'Compressing',
  'Resolving',
  'Writing',
  'Total',
  'Unpacking',
];

/**
 * Whether `line` is a `remote: <verb>` progress line streamed from the
 * server side of a git transport.
 *
 * @param line - candidate output line
 *
 * @returns whether the line matches the `remote:` progress shape
 *
 * @example
 * ```ts
 * isRemoteProgressLine('remote: Compressing objects: 100%'); // true
 * isRemoteProgressLine('remote: Hello');                     // false
 * ```
 */
function isRemoteProgressLine(line: string,): boolean {
  if (!line.startsWith(REMOTE_PROGRESS_PREFIX,))
    return false;
  /**
   * Tail of the line after the `remote: ` prefix; checked against the verb list.
   */
  const rest = line.slice(REMOTE_PROGRESS_PREFIX.length,);
  return REMOTE_PROGRESS_VERBS.some(function startsWithVerb(verb,): boolean {
    return rest.startsWith(verb,);
  },);
}

/**
 * Predicates that classify git transport-progress lines. A line that matches
 * any of these should be stripped from the filtered output.
 */
const GIT_TRANSPORT_PROGRESS_PREDICATES: readonly ((line: string,) => boolean)[] = [
  hasGitTransportPrefix,
  isTotalProgressLine,
  isRemoteProgressLine,
];

//endregion

//region Sandbox noise predicates

/**
 * Literal marker the mise sandbox cache-write warning always contains.
 */
const MISE_WARN_TOKEN = 'mise WARN';

/**
 * Literal marker that follows the WARN token and whitespace.
 */
const MISE_WARN_FAILED = 'failed to write cache file:';

/**
 * Literal marker that appears later in the line, after any context segment.
 */
const MISE_WARN_RO_FS = 'Read-only file system';

/**
 * Whether `line` is the mise read-only cache-file warning emitted by the
 * sandbox. Mirrors
 * `/^\s*(\[.*?\]\s+)?mise WARN\s+failed to write cache file:.*Read-only file system/`.
 *
 * @param line - candidate output line
 *
 * @returns whether the line is the mise sandbox cache warning
 *
 * @example
 * ```ts
 * isSandboxMiseCacheNoise('mise WARN failed to write cache file: ... Read-only file system'); // true
 * ```
 */
function isSandboxMiseCacheNoise(line: string,): boolean {
  /**
   * Skips whitespace from `idx` in `line`.
   *
   * @param idx - candidate scan offset
   *
   * @returns first index whose character is not whitespace
   *
   * @example
   * ```ts
   * skipWs(0); // 2 for line === '  mise WARN ...'
   * ```
   */
  function skipWs(idx: number,): number {
    /**
     * Cursor advanced over the whitespace run; returned as the helper-shape binding.
     */
    let at = idx;
    while ((at < line
      .length) && isWhitespace(line.charAt(at,),)) {
      at += 1;
    }
    return at;
  }
  /**
   * Position after any leading whitespace.
   */
  const afterLeadingWs = skipWs(0,);
  /**
   * Skips an optional `[...]` token followed by required whitespace. Returns
   * the original position when no such token is present or when the close
   * bracket is missing.
   *
   * @param idx - candidate scan offset
   *
   * @returns first index past the optional bracketed segment plus its trailing whitespace
   *
   * @example
   * ```ts
   * maybeSkipBracket(0); // 8 for '[INFO] mise ...'
   * ```
   */
  function maybeSkipBracket(idx: number,): number {
    if (line.charAt(idx,)
      !== '[')
      return idx;
    /**
     * Position of the closing bracket of the optional `[...]` segment.
     */
    const closeIdx = line.indexOf(
      ']',
      idx + 1,
    );
    if (closeIdx === (-1))
      return idx;
    /**
     * Position right after the closing bracket.
     */
    const afterBracket = closeIdx + 1;
    if ((afterBracket >= line
      .length) || (!isWhitespace(line.charAt(afterBracket,),)))
      return idx;
    return skipWs(afterBracket,);
  }
  /**
   * Position after any optional bracketed prefix.
   */
  const afterBracket = maybeSkipBracket(afterLeadingWs,);
  if (!line.startsWith(
    MISE_WARN_TOKEN,
    afterBracket,
  )) {
    return false;
  }
  /**
   * Position immediately after the `mise WARN` literal.
   */
  const afterToken = afterBracket + MISE_WARN_TOKEN
    .length;
  /**
   * Position after the required whitespace following `mise WARN`.
   */
  const afterTokenWs = skipWs(afterToken,);
  if (afterTokenWs === afterToken)
    return false;
  if (!line.startsWith(
    MISE_WARN_FAILED,
    afterTokenWs,
  )) {
    return false;
  }
  /**
   * Position right after the `failed to write cache file:` literal.
   */
  const afterFailed = afterTokenWs + MISE_WARN_FAILED
    .length;
  return line.slice(afterFailed,)
    .includes(MISE_WARN_RO_FS,);
}

/**
 * Predicates that classify sandbox-environment noise lines. A line that
 * matches any of these should be stripped from the filtered output.
 */
const SANDBOX_NOISE_PREDICATES: readonly ((line: string,) => boolean)[] = [
  isSandboxMiseCacheNoise,
];

//endregion

export {
  ALT_CWD_PREFIX,
  CWD_PREFIX,
  DEDUP_THRESHOLD,
  GIT_TRANSPORT_PROGRESS_PREDICATES,
  HOME_DIR,
  isGitFileModeLine,
  MAX_LINE_LENGTH,
  MAX_REPEATED_CHARS,
  PATH_PREFIX_ABSENT,
  REAL_HOME_DIR,
  SANDBOX_NOISE_PREDICATES,
};

export type { PathPrefix, };
