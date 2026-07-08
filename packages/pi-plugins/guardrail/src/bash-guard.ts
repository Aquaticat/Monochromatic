/**
 * Bash command guardrails adopted from Claude Code guardrail.
 *
 * @module
 */

import { analyzeShellCommand, } from '@monochromatic-dev/agent-harnesses-shared-shell-command-analyzer/ts';
import { BUN_TEST_BLOCK_REASON, } from './constants.ts';
import {
  GUARDRAIL_NOT_BLOCKED,
  type GuardrailDecision,
} from './types.ts';
import { isRecord, } from './value.ts';

//region Parsed command predicates

/**
 * Checks whether a shell command contains a `bun test` command anywhere in parsed shell syntax.
 *
 * Uses the shared `unbash` analyzer so quoted prose, escaped characters,
 * nested command substitutions, and function definitions are classified by
 * shell grammar instead of text boundaries. Function bodies stay visible so
 * `f(){ bun test; }; f` cannot hide the banned invocation behind a shell name.
 *
 * @param command - shell command from pi Bash tool input
 *
 * @returns whether command contains `bun test`
 *
 * @example
 * ```typescript
 * invokesBunTest('cd x && bun test'); // true
 * invokesBunTest('echo "bun test"'); // false
 * ```
 */
function invokesBunTest(command: string,): boolean {
  /**
   * Parsed shell command analysis.
   */
  const analysis = analyzeShellCommand(command,);
  if (!analysis.parsed)
    return false;

  return analysis.commands
    .some(function commandIsBunTest(info,): boolean {
    return (info.name === 'bun')
      && (info.args[0] === 'test');
  },);
}

//endregion Parsed command predicates

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
    reason: BUN_TEST_BLOCK_REASON,
  };
}

//endregion Bash guard evaluation

export {
  evaluateBashGuard,
  invokesBunTest,
};
