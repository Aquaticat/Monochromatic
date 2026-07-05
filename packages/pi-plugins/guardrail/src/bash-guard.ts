/**
 * Bash command guardrails adopted from Claude Code guardrail.
 *
 * @module
 */

import { BUN_TEST_BLOCK_REASON, } from './constants.ts';
import {
  GUARDRAIL_NOT_BLOCKED,
  type GuardrailDecision,
} from './types.ts';
import {
  isWhitespace,
  isWordChar,
} from './text-scan.ts';
import { isRecord, } from './value.ts';

//region Segment scanning

/**
 * Detects shell command separators that introduce a new command segment.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is a command boundary
 *
 * @example
 * ```typescript
 * isCommandBoundary(';'); // true
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
 * Checks whether a shell command contains a segment-leading `bun test` invocation.
 *
 * Matches start-of-command and post-separator `bun test` segments, while leaving
 * quoted prose like `echo "bun test"` alone because the phrase is not at a
 * command-segment boundary.
 *
 * @param command - shell command from pi Bash tool input
 *
 * @returns whether command invokes `bun test`
 *
 * @example
 * ```typescript
 * invokesBunTest('cd x && bun test'); // true
 * invokesBunTest('echo "bun test"'); // false
 * ```
 */
function invokesBunTest(command: string,): boolean {
  /**
   * Literal executable token detected at a segment head.
   */
  const bunToken = 'bun';
  /**
   * Literal subcommand token detected after `bun`.
   */
  const testToken = 'test';

  /**
   * Advances over whitespace from a candidate offset.
   *
   * @param idx - start offset
   *
   * @returns first non-whitespace offset at or after `idx`
   */
  function skipWhitespace(idx: number,): number {
    /**
     * Cursor advanced across a whitespace run.
     */
    let cursorIndex = idx;
    while ((cursorIndex < command.length) && isWhitespace(command.charAt(cursorIndex,),))
      cursorIndex += 1;
    return cursorIndex;
  }

  /**
   * Checks whether a candidate segment starts with `bun test`.
   *
   * @param segmentStart - offset immediately after a shell boundary
   *
   * @returns whether candidate segment begins with `bun test`
   */
  function matchesAt(segmentStart: number,): boolean {
    /**
     * Offset where `bun` would begin after leading segment whitespace.
     */
    const bunStart = skipWhitespace(segmentStart,);
    if (!command.startsWith(
      bunToken,
      bunStart,
    )) {
      return false;
    }

    /**
     * Offset immediately after candidate `bun` token.
     */
    const afterBun = bunStart + bunToken.length;
    if ((afterBun >= command.length) || (!isWhitespace(command.charAt(afterBun,),)))
      return false;

    /**
     * Offset where `test` would begin after whitespace following `bun`.
     */
    const testStart = skipWhitespace(afterBun,);
    if (!command.startsWith(
      testToken,
      testStart,
    )) {
      return false;
    }

    /**
     * Offset immediately after candidate `test` token.
     */
    const afterTest = testStart + testToken.length;
    return (afterTest >= command.length)
      || (!isWordChar(command.charAt(afterTest,),));
  }

  /**
   * Checks every separator boundary after command start.
   *
   * @returns whether any later command segment starts with `bun test`
   */
  function hasBoundaryMatch(): boolean {
    for (let index = 0; index < command.length; index += 1) {
      if (isCommandBoundary(command.charAt(index,),)
        && matchesAt(index + 1,)) {
        return true;
      }
    }
    return false;
  }

  return matchesAt(0,)
    || hasBoundaryMatch();
}

//endregion Segment scanning

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
