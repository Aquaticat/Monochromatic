import type {
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

import { parseHookJson, } from '../runtime/handler-runtime.ts';

/**
 * Whether the given subagent type represents a general-purpose agent.
 *
 * Claude Code defaults to `"general-purpose"` when `subagent_type` is omitted.
 *
 * @param subagentType - value of the `subagent_type` field from the Agent tool input
 *
 * @returns `true` when the agent would run as general-purpose
 *
 * @example
 * ```ts
 * isGeneralPurpose(undefined); // true
 * isGeneralPurpose('general-purpose'); // true
 * isGeneralPurpose('Explore'); // false
 * ```
 */
function isGeneralPurpose(subagentType: unknown,): boolean {
  return (subagentType === undefined) || (subagentType === 'general-purpose');
}

/**
 * Whether the given Bash command starts with `bun test` at a command-segment boundary.
 *
 * The leading anchor `(^|[\n;|&(])` only fires when `bun test` follows a real
 * command separator (start-of-string, newline, `;`, `|`, `&`, or `(`), so
 * quoted occurrences like `echo "bun test"` are not matched. The trailing
 * `\b` allows shell terminators like `)`, space, or end-of-string while
 * preventing matches against `bun tests` or `bun test_runner`. `bun run test`,
 * `bunx test`, and `bun build` are also unaffected because the pattern
 * requires literal `bun` then whitespace then `test`.
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
 * invokesBunTest('bun src/foo.unit.test.ts');    // false
 * invokesBunTest('bun tests');                   // false (different word)
 * ```
 */
function invokesBunTest(command: string,): boolean {
  return /(?:^|[\n;|&(])\s*bun\s+test\b/.test(command,);
}

/**
 * Output union returned by the guardrail handler.
 *
 * Either an empty allow response or a typed deny response.
 * `Record<string, never>` matches the shape of `{}` written when no action is taken.
 */
type GuardrailOutput = PreToolUseOutput | Record<string, never>;

/**
 * Guard for Agent and Bash tool calls.
 *
 * Three checks, applied in order:
 *
 * 1. **General-purpose blocking**: denies Agent calls where `subagent_type` is missing
 *    or `"general-purpose"`, directing Claude to use `spawn-claude` instead.
 *    General-purpose agents are banned due to bugs; specialized types pass through.
 *
 * 2. **Resume blocking**: denies Agent calls containing a `resume` parameter.
 *    Background agents notify automatically on completion; polling via `resume`
 *    wastes context tokens on repeated error messages.
 *
 * 3. **`bun test` blocking**: denies Bash calls that invoke `bun test`. The custom
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
function guardrailHandler(event: PreToolUseInput,): GuardrailOutput {
  if (event.tool_name === 'Bash') {
    const command = 'command' in event.tool_input
      ? event.tool_input['command']
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
            "target package's `mise.toml` first. For ad-hoc single-file runs use `bun <file>` directly",
            '(no `test` subcommand).',
          ]
            .join(' ',),
        },
      };
    }

    return {};
  }

  if (event.tool_name !== 'Agent')
    return {};

  const subagentType = 'subagent_type' in event.tool_input
    ? event.tool_input['subagent_type']
    : undefined;

  if (isGeneralPurpose(subagentType,)) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: [
          'Blocked: general-purpose Agent calls are banned due to bugs.',
          'Use spawn-claude outside sandbox to launch steerable child Claude Code sessions instead.',
          'Example: spawn-claude "your task description here"',
          'Specialized agent types (Explore, Plan, etc.) are allowed; set subagent_type explicitly.',
        ]
          .join(' ',),
      },
    };
  }

  const resume = 'resume' in event.tool_input
    ? event.tool_input['resume']
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
  return parseHookJson<PreToolUseInput>(raw,);
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
function guardrailWriter(output: GuardrailOutput,): string {
  return JSON.stringify(output,);
}

export type { GuardrailOutput, };

export {
  guardrailHandler,
  guardrailParser,
  guardrailWriter,
};
