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
 * Output union returned by the guardrail handler.
 *
 * Either an empty allow response or a typed deny response.
 * `Record<string, never>` matches the shape of `{}` written when no action is taken.
 */
type GuardrailOutput = PreToolUseOutput | Record<string, never>;

/**
 * Guard for Agent tool calls.
 *
 * Two checks, applied in order:
 *
 * 1. **General-purpose blocking** -- denies Agent calls where `subagent_type` is missing
 *    or `"general-purpose"`, directing Claude to use `spawn-claude` instead.
 *    General-purpose agents are banned due to bugs; specialized types pass through.
 *
 * 2. **Resume blocking** -- denies Agent calls containing a `resume` parameter.
 *    Background agents notify automatically on completion; polling via `resume`
 *    wastes context tokens on repeated error messages.
 *
 * Non-Agent tool calls and well-formed specialized agent calls return `{}`.
 *
 * @param event - parsed PreToolUse event from Claude Code
 *
 * @returns deny response with reason, or `{}` to allow the tool call
 */
function guardrailHandler(event: PreToolUseInput,): GuardrailOutput {
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
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed PreToolUse event
 */
function guardrailParser(raw: string,): PreToolUseInput {
  return parseHookJson<PreToolUseInput>(raw,);
}

/**
 * Serializes the guardrail output for stdout.
 *
 * No trailing newline -- matches Claude Code's wire convention.
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
