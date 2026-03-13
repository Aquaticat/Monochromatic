#!/usr/bin/env bun

/**
 * Claude Code PreToolUse hook that blocks Agent tool calls containing a `resume` parameter.
 *
 * When Claude launches background agents with `run_in_background: true`, the system
 * automatically notifies on completion. Attempting to `resume` a still-running agent
 * fails immediately, yet the model often retries in a tight polling loop -- burning
 * context tokens on repeated error messages without making progress.
 *
 * This hook denies any Agent call that includes `resume`, with an explanation
 * directing Claude to wait for the automatic completion notification instead.
 *
 * @example
 * ```jsonc
 * // In .claude/settings.json hooks config:
 * "PreToolUse": [
 *   {
 *     "matcher": "Agent",
 *     "hooks": [{ "type": "command", "command": "ccarg" }]
 *   }
 * ]
 * ```
 *
 * @module
 */

import type {
  AgentToolInput,
  PreToolUseInput,
  PreToolUseOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

import {
  readStdin,
  writeOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-utils';

export {}

//region Main

/** Raw JSON string read from stdin containing the hook event payload. */
const raw = await readStdin();

/**
 * Parsed PreToolUse event.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
const event = JSON.parse(raw) as PreToolUseInput;

/**
 * Only act on Agent tool calls.
 * The `matcher` in settings.json should already filter for this,
 * but guard defensively in case the hook is registered without a matcher.
 */
if (event.tool_name !== 'Agent') {
  writeOutput({});
} else {
  /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool_input shape matches AgentToolInput when tool_name is "Agent" */
  const agentInput = event.tool_input as AgentToolInput;

  if (agentInput.resume !== null && agentInput.resume !== undefined) {
    const output: PreToolUseOutput = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: [
          `Blocked: Agent resume call (agent ID: ${agentInput.resume}).`,
          'Background agents notify automatically on completion.',
          'Do not poll or resume running agents -- wait for the notification.',
          'If you need the result now, use TaskOutput to check the agent\'s status.',
        ].join(' '),
      },
    };
    writeOutput(output);
  } else {
    writeOutput({});
  }
}

//endregion
