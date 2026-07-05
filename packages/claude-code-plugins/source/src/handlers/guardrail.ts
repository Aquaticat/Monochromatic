import type {
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types/ts';
import { analyzeShellCommand, } from '@monochromatic-dev/agent-harnesses-shell-command-analyzer/ts';
import type { ReadonlyDeep, } from 'type-fest';

/**
 * Whether the given Bash command executes `bun test`.
 *
 * Uses the shared `unbash` analyzer so quoted prose, escaped characters,
 * nested command substitutions, and function definitions are classified by
 * shell grammar instead of text boundaries.
 *
 * @param command - Shell command from Bash tool input
 *
 * @returns `true` when `bun test` would execute as a command
 *
 * @example
 * ```ts
 * invokesBunTest('bun test foo.ts');             // true
 * invokesBunTest('cd x && bun test');            // true
 * invokesBunTest('echo "bun test"');             // false
 * invokesBunTest('f(){ bun test; }');            // false
 * ```
 */
function invokesBunTest(command: string,): boolean {
  /**
   * Parsed shell command analysis.
   */
  const analysis = analyzeShellCommand(command,);
  if (!analysis.parsed)
    return false;

  return analysis.executedCommands.some(function commandIsBunTest(info,): boolean {
    return (info.name === 'bun')
      && (info.args[0] === 'test');
  },);
}

/**
 * Output returned by the guardrail handler.
 *
 * Either a typed deny response or the empty pass-through `{}`.
 * Every {@link PreToolUseOutput} field is optional, so `{}` is itself a valid
 * {@link PreToolUseOutput}; no separate empty type is needed.
 */
type GuardrailOutput = PreToolUseOutput;

/**
 * Deny response for misleading `bun test` invocations.
 */
const BUN_TEST_DENY_OUTPUT: GuardrailOutput = {
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

/**
 * Build deny response for Agent resume polling.
 *
 * @param resume - Agent resume identifier
 *
 * @returns deny response explaining automatic background notifications
 *
 * @example
 * ```ts
 * agentResumeDenyOutput('agent-id');
 * ```
 */
function agentResumeDenyOutput(resume: string,): GuardrailOutput {
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

/**
 * Guard for Agent and Bash tool calls.
 *
 * @param event - parsed {@link PreToolUseInput} event from Claude Code
 *
 * @returns deny response with reason, or `{}` to allow tool call
 *
 * @example
 * ```ts
 * guardrailHandler({ tool_name: 'Bash', tool_input: { command: 'mise run //pkg:test' }, ... });
 * ```
 */
function guardrailHandler(event: ReadonlyDeep<PreToolUseInput>,): GuardrailOutput {
  if (event.tool_name === 'Bash') {
    /**
     * Bash command string extracted defensively; `undefined` when field is absent.
     */
    const command = 'command' in event.tool_input
      ? event.tool_input.command
      : undefined;

    if (((typeof command) === 'string') && invokesBunTest(command,))
      return BUN_TEST_DENY_OUTPUT;

    return {};
  }

  if (event.tool_name !== 'Agent')
    return {};

  /**
   * Agent's `resume` field; presence triggers no-polling deny path.
   */
  const resume = 'resume' in event.tool_input
    ? event.tool_input.resume
    : undefined;

  if ((typeof resume) === 'string')
    return agentResumeDenyOutput(resume,);

  return {};
}

/**
 * Parses raw stdin as a {@link PreToolUseInput}.
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
 * Serializes guardrail output for stdout.
 *
 * No trailing newline; matches Claude Code's wire convention.
 *
 * @param output - {@link GuardrailOutput} handler result to serialize
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
