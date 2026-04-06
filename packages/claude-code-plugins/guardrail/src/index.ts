#!/usr/bin/env bun

/**
 * Claude Code PreToolUse hook that guards Agent tool calls with two checks:
 *
 * 1. **General-purpose blocking** -- denies Agent calls where `subagent_type` is missing
 *    or `"general-purpose"`, directing Claude to use `spawn-claude` instead.
 *    General-purpose agents are banned due to bugs; specialized types (Explore, Plan, etc.)
 *    pass through.
 *
 * 2. **Resume blocking** -- denies Agent calls containing a `resume` parameter.
 *    Background agents notify automatically on completion; polling via `resume` wastes
 *    context tokens on repeated error messages.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "PreToolUse": [
 *   {
 *     "hooks": [{ "type": "command", "command": "ccgr" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import type {
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

import {
  readStdin,
  writeOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

export {};

//region Helpers

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
  return subagentType === undefined || subagentType === 'general-purpose';
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
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw,) as PreToolUseInput;

/**
 * Only act on Agent tool calls.
 * The `matcher` in settings.json should already filter for this,
 * but guard defensively in case the hook is registered without a matcher.
 */
if (event.tool_name !== 'Agent')
  writeOutput({},);
else {
  /** Subagent type from tool input, narrowed via `in` check on the generic record. */
  const subagentType = 'subagent_type' in event.tool_input
    ? event.tool_input['subagent_type']
    : undefined;

  if (isGeneralPurpose(subagentType,)) {
    /** Denial response blocking general-purpose Agent calls with a redirect to spawn-claude. */
    const output: PreToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: [
          'Blocked: general-purpose Agent calls are banned due to bugs.',
          'Use spawn-claude outside sandbox to launch steerable child Claude Code sessions instead.',
          'Example: spawn-claude "your task description here"',
          'Specialized agent types (Explore, Plan, etc.) are allowed -- set subagent_type explicitly.',
        ]
          .join(' ',),
      },
    };
    writeOutput(output,);
  }
  else {
    /** Resume field from tool input, narrowed via `in` check on the generic record. */
    const resume = 'resume' in event.tool_input
      ? event.tool_input['resume']
      : undefined;

    if (typeof resume === 'string') {
      /** Denial response blocking the resume attempt with an explanatory reason. */
      const output: PreToolUseOutput = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: [
            `Blocked: Agent resume call (agent ID: ${resume}).`,
            'Background agents notify automatically on completion.',
            'Do not poll or resume running agents -- wait for the notification.',
            "If you need the result now, use TaskOutput to check the agent's status.",
          ]
            .join(' ',),
        },
      };
      writeOutput(output,);
    }
    else {
      writeOutput({},);
    }
  }
}

//endregion
