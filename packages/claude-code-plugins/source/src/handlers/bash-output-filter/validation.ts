/**
 * Command validation patterns for the Bash output filter hook.
 *
 * Provides allowlist and denylist checks that determine whether a Bash command
 * should be piped through the output filter.
 *
 * @module
 */

//region Allowlist

/**
 * Positive patterns that identify commands safe to pipe through the filter.
 * A command must match at least one of these to be considered for filtering.
 */
const ALLOW_PATTERNS: readonly RegExp[] = [
  /^[a-zA-Z0-9_/.~"'-]/,
];

/**
 * Whether a command looks like a normal text command that is safe to pipe.
 *
 * @param command - full Bash command string from the tool input
 *
 * @returns `true` if the command matches the allowlist patterns
 *
 * @example
 * ```ts
 * isAllowed('git status'); // true
 * isAllowed('!special'); // false
 * ```
 */
function isAllowed(command: string,): boolean {
  return ALLOW_PATTERNS.some(function patternTest(pattern,) {
    return pattern.test(command,);
  },);
}

//endregion

//region Denylist

/**
 * Commands that should NOT be piped through the filter. Piping appends
 * `2>&1 | bun filter.mjs && true` to the command, which breaks binary output,
 * already-redirected output, background processes, and TTY negotiation.
 */
const SKIP_PATTERNS: readonly RegExp[] = [
  /\b(xxd|hexdump|od|base64|tar|gzip|gunzip|zip|unzip|bzip2|xz|zstd)\b/,
  />\s*[^\s|&;]/,
  /\bfilter\.(mjs|ts)\b/,
  /___BOF_EC:/,
  /&\s*$/,
  /\b(nohup|setsid)\b/,
  /\b(docker|podman)\s+(exec|run)\b.*-[a-z]*[it]/,
  /\bbun\s+build\b/,
  /\$\(/,
  /`[^`]+`/,
  /[<>]\(/,
  /<<[<-]?\s*\S/,
  /\b(cd|pushd|popd|export|unset|source)\b/,
  /^\.\s/,
  /\beval\b/,
];

/**
 * Whether a command should be skipped (not piped through the filter).
 *
 * @param command - full Bash command string from the tool input
 *
 * @returns `true` if the command matches any denylist pattern
 *
 * @example
 * ```ts
 * shouldSkip('xxd file.bin'); // true (binary tool denylisted)
 * shouldSkip('git status'); // false
 * ```
 */
function shouldSkip(command: string,): boolean {
  return SKIP_PATTERNS.some(function patternTest(pattern,) {
    return pattern.test(command,);
  },);
}

//endregion

export {
  isAllowed,
  shouldSkip,
};
