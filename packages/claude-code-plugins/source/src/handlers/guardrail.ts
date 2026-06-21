import type {
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types/ts';
import type { ReadonlyDeep, } from 'type-fest';

import {
  isWhitespace,
  isWordChar,
} from '../lib/text-scan.ts';

/**
 * Whether `c` is a shell command separator that introduces a new command
 * segment.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether `c` is one of `\n`, `;`, `|`, `&`, `(`
 *
 * @example
 * ```ts
 * isCommandBoundary(';'); // true
 * isCommandBoundary(' '); // false
 * ```
 */
function isCommandBoundary(c: string,): boolean {
  return (c === '\n')
    || (c === ';')
    || (c === '|')
    || (c === '&')
    || (c === '(');
}

/**
 * Whether the given Bash command starts with `bun test` at a command-segment boundary.
 *
 * Mirrors the original regex `(?:^|[\n;|&(])\s*bun\s+test\b`: matches only
 * when `bun test` follows a real command separator (start-of-string, newline,
 * `;`, `|`, `&`, or `(`), so quoted occurrences like `echo "bun test"` are
 * not matched. A word-boundary check on the character after `test` keeps
 * `bun tests` and `bun test_runner` out; the required whitespace between
 * `bun` and `test` keeps `bun build`, `bun run test`, `bunx test` out.
 *
 * @param command - Shell command from the Bash tool's `tool_input.command`
 *
 * @returns `true` when `bun test` would actually execute as a command
 *
 * @example
 * ```ts
 * invokesBunTest('bun test foo.ts');             // true
 * invokesBunTest('cd x && bun test');            // true
 * invokesBunTest('(bun test)');                  // true
 * invokesBunTest('echo "bun test"');             // false (inside quotes)
 * invokesBunTest('bun run test');                // false (different command)
 * invokesBunTest('node src/foo.unit.test.ts');   // false
 * invokesBunTest('bun tests');                   // false (different word)
 * ```
 */
function invokesBunTest(command: string,): boolean {
  /**
   * Literal segment-leading word the matcher looks for.
   */
  const BUN = 'bun';
  /**
   * Literal subcommand the matcher looks for after `bun` + whitespace.
   */
  const TEST = 'test';
  /**
   * Advances past consecutive whitespace from `idx`.
   *
   * @param idx - candidate scan offset
   *
   * @returns first index whose character is not whitespace
   *
   * @example
   * ```ts
   * skipWhitespace(0); // 2 for command === '  bun'
   * ```
   */
  function skipWhitespace(idx: number,): number {
    /**
     * Cursor advanced over the whitespace run; returned as the helper-shape binding.
     */
    let at = idx;
    while ((at < command
      .length) && isWhitespace(command.charAt(at,),)) {
      at += 1;
    }
    return at;
  }
  /**
   * Checks whether `pos` (taken as a segment start) is followed by
   * optional whitespace, `bun`, whitespace, `test`, then a word boundary.
   *
   * @param pos - segment start position
   *
   * @returns whether the segment runs `bun test` at its head
   *
   * @example
   * ```ts
   * matchesAt(0); // true for command === 'bun test foo'
   * ```
   */
  function matchesAt(pos: number,): boolean {
    /**
     * Position of the `bun` token candidate.
     */
    const bunStart = skipWhitespace(pos,);
    if (!command.startsWith(
      BUN,
      bunStart,
    )) {
      return false;
    }
    /**
     * Position immediately after the candidate `bun`.
     */
    const afterBun = bunStart + BUN
      .length;
    if ((afterBun >= command
      .length) || (!isWhitespace(command.charAt(afterBun,),)))
      return false;
    /**
     * Position of the `test` token candidate.
     */
    const testStart = skipWhitespace(afterBun,);
    if (!command.startsWith(
      TEST,
      testStart,
    )) {
      return false;
    }
    /**
     * Position immediately after the candidate `test`.
     */
    const afterTest = testStart + TEST
      .length;
    return (afterTest >= command
      .length) || (!isWordChar(command.charAt(afterTest,),));
  }
  /**
   * Scans `command` for boundary characters; reports success when any
   * boundary is followed by a `bun test` segment.
   *
   * @param fromIdx - candidate scan offset
   *
   * @returns whether a `bun test` segment is found at any boundary
   *
   * @example
   * ```ts
   * scanForBoundary(0); // true for command === 'cd x && bun test'
   * ```
   */
  function scanForBoundary(fromIdx: number,): boolean {
    // Scan every position from `fromIdx`; a command separator immediately
    // followed by a `bun test` segment confirms the invocation.
    for (let cursorIndex = fromIdx; cursorIndex < command
      .length; cursorIndex += 1) {
      if (isCommandBoundary(command.charAt(cursorIndex,),)
        && matchesAt(cursorIndex + 1,))
        return true;
    }
    return false;
  }
  return matchesAt(0,)
    || scanForBoundary(0,);
}

/**
 * Output returned by the guardrail handler.
 *
 * Either a typed deny response or the empty pass-through `{}`.
 * Every `PreToolUseOutput` field is optional, so `{}` (written when no action
 * is taken) is itself a valid `PreToolUseOutput`; no separate empty type is needed.
 */
type GuardrailOutput = PreToolUseOutput;

/**
 * Guard for Agent and Bash tool calls.
 *
 * Two checks, applied in order:
 *
 * 1. **Resume blocking**: denies Agent calls containing a `resume` parameter.
 *    Background agents notify automatically on completion; polling via `resume`
 *    wastes context tokens on repeated error messages.
 *
 * 2. **`bun test` blocking**: denies Bash calls that invoke `bun test`. The custom
 *    `@monochromatic-dev/module-test` harness runs tests as a side effect of
 *    module import, so `bun test <file>` prints `PASS` lines (from the harness)
 *    followed by `0 pass / 0 fail` (from bun's runner finding no `bun:test`
 *    registrations). The misleading summary suggests the run was broken when it
 *    actually passed.
 *
 * Non-matching tool calls return `{}`.
 *
 * @param event - parsed PreToolUse event from Claude Code
 *
 * @returns deny response with reason, or `{}` to allow the tool call
 *
 * @example
 * ```ts
 * guardrailHandler({ tool_name: 'Agent', tool_input: { subagent_type: 'Explore' }, ... });
 * guardrailHandler({ tool_name: 'Bash', tool_input: { command: 'mise run //pkg:test' }, ... });
 * ```
 */
function guardrailHandler(event: ReadonlyDeep<PreToolUseInput>,): GuardrailOutput {
  if (event.tool_name
    === 'Bash') {
    /**
     * Bash command string extracted defensively; `undefined` when the field is absent.
     */
    const command = 'command' in event
      .tool_input
      ? event.tool_input
        .command
      : undefined;

    if (((typeof command) === 'string') && invokesBunTest(command,)) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: [
            'Blocked: `bun test` invocations are banned in this repo.',
            'The custom `@monochromatic-dev/module-test` harness runs tests as a side effect of module import,',
            "so `bun test <file>` reports `0 pass / 0 fail` even when every test passed (the harness's `PASS`",
            "log lines are not measured by bun's test runner).",
            'Use `mise run //packages/<path>:test:unit` instead. When no such task exists, add one to the',
            "target package's `mise.toml` first. For ad-hoc single-file runs use `node <file>` directly",
            '(no `test` subcommand).',
          ]
            .join(' ',),
        },
      };
    }

    return {};
  }

  if (event.tool_name
    !== 'Agent')
    return {};

  /**
   * Agent's `resume` field; presence triggers the no-polling deny path.
   */
  const resume = 'resume' in event
    .tool_input
    ? event.tool_input
      .resume
    : undefined;

  if ((typeof resume) === 'string') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: [
          `Blocked: Agent resume call (agent ID: ${resume}).`,
          'Background agents notify automatically on completion.',
          'Do not poll or resume running agents; wait for the notification.',
          "If you need the result now, use TaskOutput to check the agent's status.",
        ]
          .join(' ',),
      },
    };
  }

  return {};
}

/**
 * Parses raw stdin as a `PreToolUseInput`.
 *
 * Input is trusted; it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed PreToolUse event
 *
 * @example
 * ```ts
 * const event = guardrailParser(await text(process.stdin));
 * ```
 */
function guardrailParser(raw: string,): PreToolUseInput {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSON contract from Claude Code hook system
  return JSON.parse(raw,) as PreToolUseInput;
}

/**
 * Serializes the guardrail output for stdout.
 *
 * No trailing newline; matches Claude Code's wire convention.
 *
 * @param output - handler result to serialize
 *
 * @returns JSON string for stdout
 *
 * @example
 * ```ts
 * process.stdout.write(guardrailWriter({}));
 * ```
 */
function guardrailWriter(output: ReadonlyDeep<GuardrailOutput>,): string {
  return JSON.stringify(output,);
}

export type { GuardrailOutput, };

export {
  guardrailHandler,
  guardrailParser,
  guardrailWriter,
};
