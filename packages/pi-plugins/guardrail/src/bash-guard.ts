/**
 * Bash command guardrails adopted from Claude Code guardrail.
 *
 * @module
 */

import {
  BUN_TEST_BAN_REASON,
  invokesBunTest,
} from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';
import {
  GUARDRAIL_NOT_BLOCKED,
  type GuardrailDecision,
} from './types.ts';
import { isRecord, } from './value.ts';

//region Bash guard evaluation

/**
 * Applies the `bun test` guard to a Bash tool input.
 *
 * @param input - pi Bash tool input
 *
 * @returns block decision when command invokes `bun test`, otherwise `undefined`
 *
 * @example
 * ```typescript
 * evaluateBashGuard({ command: 'bun test' });
 * ```
 */
function evaluateBashGuard(input: unknown,): GuardrailDecision {
  if (!isRecord(input,))
    return GUARDRAIL_NOT_BLOCKED;

  /**
   * Command candidate read defensively from external tool input.
   */
  const { command, } = input;
  if (((typeof command) !== 'string') || (!invokesBunTest(command,)))
    return GUARDRAIL_NOT_BLOCKED;

  return {
    block: true,
    reason: BUN_TEST_BAN_REASON,
  };
}

//endregion Bash guard evaluation

export { evaluateBashGuard, };
