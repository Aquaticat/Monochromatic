#!/usr/bin/env bun

/**
 * Claude Code PreToolUse hook that pipes Bash tool output through a filter
 * to strip wasteful patterns (git boilerplate, long lines, repeated diagnostics).
 *
 * Uses dual-layer safety: an allowlist ensures the command looks like a normal
 * text command, and a denylist catches specific constructs that break piping.
 *
 * The filter runs inside the sandbox as the right side of a pipe,
 * so filesystem and network restrictions are preserved.
 *
 * @example
 * ```jsonc
 * // In .claude-plugin/plugin.json hooks config:
 * "PreToolUse": [
 *   {
 *     "matcher": "Bash",
 *     "hooks": [{ "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/dist/final/node/index.mjs" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import type {
  BashToolInput,
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

import {
  readStdin,
  writeOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

export {}

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
const ALLOW_PATTERNS = [
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
 * @returns `true` if the command matches the allowlist patterns.
 */
function isAllowed(command: string): boolean {
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
const SKIP_PATTERNS = [
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
 * @returns `true` if the command matches any denylist pattern and should not be filtered.
 */
function shouldSkip(command: string): boolean {
  return SKIP_PATTERNS.some(function patternTest(pattern) {
    return pattern.test(command)
  })
}

//endregion

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed PreToolUse event.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as PreToolUseInput;

if (event.tool_name !== 'Bash') {
  writeOutput({});
} else {
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- tool_input shape matches BashToolInput when tool_name is "Bash" */
  const bashInput = event.tool_input as BashToolInput;

  if (!isAllowed(bashInput.command) || shouldSkip(bashInput.command)) {
    writeOutput({});
  } else {
    /**
     * Absolute path to the filter script, resolved relative to this hook script.
     *
     * When running the built artifact (`dist/final/node/index.mjs`), this resolves to
     * `dist/final/node/filter.mjs`. When running from source (`src/index.ts`),
     * this resolves to `src/filter.ts` -- which bun can execute directly.
     *
     * Uses `import.meta.dir` which gives the directory of the currently executing file,
     * regardless of how it was invoked.
     */
    const isBuilt = import.meta.url.endsWith('.mjs')
    const filterPath = isBuilt
      ? `${import.meta.dir}/filter.mjs`
      : `${import.meta.dir}/filter.ts`

    /**
     * Rewritten command that pipes output through the filter.
     *
     * Structure: `set -o pipefail && <cmd> 2>&1 | bun <filter> && true`
     *
     * - `set -o pipefail` enables pipefail so the pipeline's exit code is the
     *   first non-zero exit from any command (i.e. the original command's code),
     *   rather than the filter's exit code (always 0)
     * - `&&` chains pipefail setup with the pipeline without using `;`
     * - `2>&1` merges stderr into stdout so progress lines (git push) are captured
     * - `| bun ${filterPath}` runs the filter inside the sandbox
     * - `&& true` serves as a sacrificial target for the sandbox's
     *   `< /dev/null` append (see below)
     *
     * **`< /dev/null` absorption:**
     * the sandbox's eval chain appends `< /dev/null` to the last simple command
     * in the command string. Without a suffix, the filter becomes the last command
     * and `< /dev/null` overrides its pipe stdin -- the filter reads nothing,
     * outputs nothing, and the left side of the pipe gets SIGPIPE (exit 141).
     * The `&& true` suffix absorbs `< /dev/null` harmlessly: bash parses
     * `cmd | filter && true < /dev/null` with the redirect on `true`,
     * not on `filter`. Since `true` does not read stdin, the redirect is inert.
     *
     * **Exit code propagation without shell variables:**
     * when the pipeline succeeds (exit 0), `&& true` runs and exits 0.
     * When the pipeline fails (exit N), `&&` is not taken and the pipeline's
     * exit code (N) propagates as the overall exit code.
     * This avoids `$?`, `$PIPESTATUS`, and all shell variable expansion,
     * which the sandbox's eval chain corrupts or empties.
     *
     * This avoids five failure modes in the sandbox's eval chain:
     *
     * 1. `{ ...; }` compound command grouping is broken -- the sandbox treats `{`
     *    as a command name rather than a bash reserved word, causing
     *    `bash: command not found: {`
     *
     * 2. `$PIPESTATUS` and shell variables across `;` boundaries are unreliable --
     *    the sandbox appears to evaluate `;`-separated segments in separate contexts,
     *    so `$PIPESTATUS` after `;` may not reference the preceding pipeline.
     *    This caused intermittent `exit: of: numeric argument required` errors
     *    with the `_bof=$PIPESTATUS; (exit "$_bof")` approach.
     *
     * 3. `bash -c '...'` adds an extra quoting/expansion layer that corrupts
     *    special characters -- `!` inside double-quoted strings (e.g. `bun -e
     *    "if (!x)"`) gets escaped to `\!`, causing `Unexpected escape sequence`
     *    errors in the evaluated code.
     *
     * 4. Without a suffix after the pipeline, `< /dev/null` lands on the filter,
     *    breaking the pipe and causing SIGPIPE (exit 141) on the left side.
     *
     * 5. `$?` in suffix positions (e.g. `|| (exit $?)`) expands to empty,
     *    causing `exit: : numeric argument required`.
     *
     * The filter is designed to always exit 0 (catches all errors internally),
     * so `pipefail` reliably surfaces the original command's exit code.
     */
    const wrappedCommand = `set -o pipefail && ${bashInput.command} 2>&1 | bun ${filterPath} && true`

    const output: PreToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...bashInput,
          command: wrappedCommand,
        },
      },
    };

    writeOutput(output);
  }
}

//endregion
