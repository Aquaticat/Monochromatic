/**
 * JSON extraction and verdict parsing helpers for judge responses.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { Verdict, } from './types.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for the judge-json module.
 */
const moduleLogger = tagged({
  tag: 'judge-json',
  l: parentLogger,
},);

/**
 * Maximum characters of judge text to include in error messages.
 */
const JUDGE_TEXT_ERROR_LIMIT = 200;

/**
 * Extract a JSON verdict from free-text model output.
 *
 * Tries `JSON.parse(text)` first, then falls back to
 * {@link findBalancedJsonObject} scanning for the first balanced `{...}`
 * block. Balanced scanning ignores braces inside
 * string literals so a `"reason"` field containing `{` does not skew the
 * boundaries.
 *
 * @param text - model's text output
 *
 * @returns parsed verdict arguments
 *
 * @throws when no parseable JSON object is found in the text
 *
 * @example
 * ```typescript
 * extractJsonVerdict('{"verdict":"approve"}');
 * extractJsonVerdict('preface {"verdict":"deny"} suffix');
 * ```
 */
function extractJsonVerdict(
  text: string,
): Record<string, string> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown.
    return JSON.parse(text,) as Record<string, string>;
  }
  catch (error) {
    /**
     * Sub-logger tagged with this function name for the handled parse failure before the balanced-brace fallback.
     */
    const innerL = tagged({
      tag: extractJsonVerdict.name,
      l: moduleLogger,
    },);
    innerL.debug(`direct JSON parse failed; scanning for balanced brace block: ${String(error,)}`,);
  }

  /**
   * First balanced `{...}` block found in the free-text output, or empty when none exists.
   */
  const block = findBalancedJsonObject(text,);
  if (block === '') {
    throw new Error(
      `Judge returned text without JSON verdict: ${
        text.slice(
          0,
          JUDGE_TEXT_ERROR_LIMIT,
        )
      }`,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown.
  return JSON.parse(block,) as Record<string, string>;
}

/**
 * Find the first balanced `{...}` block in a string, ignoring braces
 * inside string literals.
 *
 * Tracks string state and escapes so a `"text with } inside"` field
 * does not terminate the scan early.
 *
 * @param text - string to scan
 *
 * @returns matched block including delimiters, or empty string when no
 *   balanced object is found
 *
 * @example
 * ```typescript
 * findBalancedJsonObject('x {"ok":true} y');
 * ```
 */
function findBalancedJsonObject(text: string,): string {
  /**
   * Index of the first `{` in the text; the scan starts here.
   */
  const start = text.indexOf('{',);
  if (start === (-1))
    return '';

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- balanced-brace scanner state machine mutated across the character loop (depth counter, string-mode latch, escape latch) */
  /**
   * Brace nesting depth; the slice is taken when this returns to 0.
   */
  let depth = 0;
  /**
   * True while the scan is inside a double-quoted string literal so braces are ignored.
   */
  let inString = false;
  /**
   * True after a backslash inside a string so the next character is treated as literal.
   */
  let escape = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (let loopIndex = start; loopIndex < text
    .length; loopIndex++) {
    /**
     * Character at the current scan position, used by the state machine below.
     */
    const ch = text[loopIndex];

    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\')
        escape = true;
      else if (ch === '"')
        inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{')
      depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(
          start,
          loopIndex + 1,
        );
      }
    }
  }
  return '';
}

/**
 * Parse raw tool call or JSON retry arguments into a Verdict.
 *
 * @param args - raw verdict arguments
 *
 * @returns structured verdict
 *
 * @example
 * ```typescript
 * parseVerdict({ verdict: 'deny', reason: 'dangerous', guidance: 'Use propose_trust' });
 * ```
 */
function parseVerdict(
  args: Readonly<Record<string, string>>,
): Verdict {
  /**
   * Raw verdict string, defaulted to `ask` when missing so the union check below decides.
   */
  const verdict = args.verdict
    ?? 'ask';
  /**
   * Free-text rationale captured from the judge response.
   */
  const reason = args.reason
    ?? '';
  /**
   * Guidance string to surface back to the agent; empty for approvals.
   */
  const guidance = args.guidance
    ?? '';

  if (
    (verdict !== 'approve')
    && (verdict !== 'deny')
      && (verdict !== 'ask')
  ) {
    return {
      verdict: 'ask',
      reason: `Judge returned unexpected verdict: "${verdict}". ${reason}`,
      guidance: '',
    };
  }

  return {
    verdict,
    reason,
    guidance,
  };
}

export {
  extractJsonVerdict,
  parseVerdict,
};
