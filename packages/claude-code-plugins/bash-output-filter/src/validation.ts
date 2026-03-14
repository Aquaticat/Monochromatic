/**
 * Command validation patterns for the Bash output filter hook.
 *
 * Provides allowlist and denylist checks that determine whether a Bash command
 * should be piped through the output filter. The allowlist identifies safe
 * text commands; the denylist catches constructs that break piping.
 *
 * @module
 */

//region Allowlist

/**
 * Positive patterns that identify commands safe to pipe through the filter.
 *
 * A command must match at least one of these to be considered for filtering.
 * This is the first safety layer -- anything not matching is left untouched.
 *
 * The command string may contain chaining operators (`&&`, `||`, `;`)
 * and flags/arguments -- these are all safe because the pipe is appended
 * at the end, after the full command.
 */
export const ALLOW_PATTERNS = [
  /**
   * Command composed of normal shell characters:
   * - Letters, digits, underscores (command names, variables)
   * - Paths (`/`, `.`, `~`)
   * - Flags (`-`)
   * - Quoting (`"`, `'`)
   * - Whitespace, chaining (`&&`, `||`, `;`), and common operators
   *
   * This rejects commands starting with grouping syntax (`(`, `{`, `[`)
   * or containing constructs caught by the denylist.
   */
  /^[a-zA-Z0-9_/.~"'-]/,
]

/**
 * Whether a command looks like a normal text command that is safe to pipe.
 *
 * @param command - Full Bash command string from the tool input.
 *
 * @returns `true` if the command matches the allowlist patterns.
 */
export function isAllowed(command: string): boolean {
  return ALLOW_PATTERNS.some(function patternTest(pattern) {
    return pattern.test(command)
  })
}

//endregion

//region Denylist

/**
 * Commands that should NOT be piped through the filter.
 *
 * Piping adds `2>&1 | bun filter.ts; ...` to the command, which breaks:
 * - Binary/non-text output (images, archives, compiled files)
 * - Commands that already pipe to a file or another process (double-pipe)
 * - Background/daemon processes (the pipe holds the process open)
 * - Commands that rely on separate stdout/stderr streams
 */
export const SKIP_PATTERNS = [
  /**
   * Commands that produce or manipulate binary data.
   * Piping binary through a text filter corrupts the output.
   */
  /\b(xxd|hexdump|od|base64|tar|gzip|gunzip|zip|unzip|bzip2|xz|zstd)\b/,

  /**
   * Commands that already redirect output to a file.
   * Adding a pipe after `> file` changes semantics.
   */
  />\s*[^\s|&;]/,

  /**
   * Commands that already use our filter (prevent double-wrapping on retry).
   * Matches both built (`filter.mjs`) and source (`filter.ts`) paths,
   * as well as the in-band exit code marker.
   */
  /\bfilter\.(mjs|ts)\b/,
  /___BOF_EC:/,

  /**
   * Background commands (`&` at the end, `nohup`, `setsid`).
   * Piping holds the foreground open until the background process exits.
   */
  /&\s*$/,
  /\b(nohup|setsid)\b/,

  /**
   * Docker/podman exec and run with `-it` flags (interactive/TTY).
   * Piping breaks TTY negotiation.
   */
  /\b(docker|podman)\s+(exec|run)\b.*-[a-z]*[it]/,

  /**
   * `bun build` output is used to verify build success and paths.
   * The structured output (entry points, sizes) should not be filtered.
   */
  /\bbun\s+build\b/,

  /**
   * Command substitution (`$(...)` or backticks).
   * Appending a pipe after `$(cmd)` can change evaluation order.
   */
  /\$\(/,
  /`[^`]+`/,

  /**
   * Process substitution (`<(...)` or `>(...)`).
   * These create fd-backed pipes that conflict with our appended pipe.
   */
  /[<>]\(/,

  /**
   * Here documents and here strings.
   * Appending a pipe after `<<` breaks the heredoc terminator detection.
   */
  /<<[<-]?\s*\S/,

  /**
   * Shell builtins that change state which must persist to the parent shell.
   * Piping runs the left side in a subshell, so side effects are lost:
   * - `cd` / `pushd` / `popd` -- directory changes (Claude Code tracks cwd)
   * - `export` / `unset` -- environment variable modifications
   * - `source` / `.` -- sourcing files into the current shell
   * - `eval` -- arbitrary evaluation that may have state side effects
   */
  /\b(cd|pushd|popd|export|unset|source)\b/,
  /^\.\s/,
  /\beval\b/,
]

/**
 * Whether a command should be skipped (not piped through the filter).
 *
 * @param command - Full Bash command string from the tool input.
 *
 * @returns `true` if the command matches any denylist pattern and should not be filtered.
 */
export function shouldSkip(command: string): boolean {
  return SKIP_PATTERNS.some(function patternTest(pattern) {
    return pattern.test(command)
  })
}

//endregion
