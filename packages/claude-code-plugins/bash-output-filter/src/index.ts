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

import {
  isAllowed,
  shouldSkip,
} from './validation.ts';

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed PreToolUse event.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw,) as PreToolUseInput;

if (event.tool_name !== 'Bash')
  writeOutput({},);
else {
  /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool_input shape matches BashToolInput when tool_name is "Bash" */
  /** Typed tool input after verifying tool_name is "Bash". */
  const bashInput = event.tool_input as BashToolInput;

  if (!isAllowed(bashInput.command,) || shouldSkip(bashInput.command,))
    writeOutput({},);
  else {
    /**
     * Absolute path to the filter script, resolved relative to this hook script.
     *
     * When running the built artifact (`dist/final/node/index.mjs`), this resolves to
     * `dist/final/node/filter.mjs`. When running from source (`src/index.ts`),
     * this resolves to `src/filter.ts` -- which bun can execute directly.
     *
     * Uses `import.meta.dirname` which gives the directory of the currently executing file,
     * regardless of how it was invoked.
     */
    /** Whether running from the built artifact vs source. */
    const isBuilt = import.meta.url.endsWith('.mjs',);
    /** Resolved path to the filter script. */
    const filterPath = isBuilt
      ? `${import.meta.dirname}/filter.mjs`
      : `${import.meta.dirname}/filter.ts`;

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
     * - `| bun $\{filterPath\}` runs the filter inside the sandbox
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
     *    special characters -- `!` inside double-quoted strings (e.g. `bun -e "if (!x)"`)
     *    gets escaped to `\!`, causing `Unexpected escape sequence` errors in the evaluated code.
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
    const wrappedCommand =
      `set -o pipefail && ${bashInput.command} 2>&1 | bun ${filterPath} && true`;

    /** Hook output that rewrites the Bash command to pipe through the filter. */
    const output: PreToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        updatedInput: {
          ...bashInput,
          command: wrappedCommand,
        },
      },
    };

    writeOutput(output,);
  }
}

//endregion
