/**
 * Auto-mode verdict parser over shared balanced JSON extraction.
 *
 * @module
 */

import { extractStructuredJson, } from '@monochromatic-dev/pi-shared-model-review/ts';

import type { Verdict, } from './types.ts';

/**
 * Narrow unknown JSON value to property record.
 *
 * @param value - parsed reviewer value
 *
 * @returns whether value supports string property lookup
 *
 * @example
 * ```ts
 * isRecord({ verdict: 'approve' });
 * ```
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null)
    && ((typeof value) === 'object');
}

/**
 * Extract JSON reviewer arguments using shared balanced-object scanner.
 *
 * @param text - direct reviewer output
 *
 * @returns parsed reviewer property record
 *
 * @throws when output contains no object
 *
 * @example
 * ```ts
 * extractJsonVerdict('prefix {"verdict":"approve"} suffix');
 * ```
 */
function extractJsonVerdict(text: string,): Record<string, unknown> {
  /**
   * Shared whole-text or balanced-object parse result.
   */
  const value = extractStructuredJson(text,);
  if (!isRecord(value,))
    throw new Error('Judge JSON verdict must be an object',);
  return value;
}

/**
 * Parse unknown structured reviewer value into auto-mode verdict.
 *
 * Missing fields retain historical defaults.
 * Unknown string verdicts degrade to `ask` with diagnostic reason.
 * Mistyped fields reject candidate attempt so shared availability fallback can run.
 *
 * @param value - unknown tool arguments or direct JSON value
 *
 * @returns normalized auto-mode verdict
 *
 * @throws when value or fields have malformed types
 *
 * @example
 * ```ts
 * parseVerdict({ verdict: 'deny', reason: 'unsafe', guidance: 'Use dry run.' });
 * ```
 */
function parseVerdict(value: unknown,): Verdict {
  if (!isRecord(value,))
    throw new Error('Judge verdict must be an object',);
  /**
   * Verdict discriminator with historical missing-field default.
   */
  const verdict = value.verdict
    ?? 'ask';
  /**
   * Judge rationale with historical missing-field default.
   */
  const reason = value.reason
    ?? '';
  /**
   * Agent guidance with historical missing-field default.
   */
  const guidance = value.guidance
    ?? '';
  if ((typeof verdict) !== 'string')
    throw new Error('Judge verdict field must be a string',);
  if ((typeof reason) !== 'string')
    throw new Error('Judge reason field must be a string',);
  if ((typeof guidance) !== 'string')
    throw new Error('Judge guidance field must be a string',);
  if ((verdict !== 'approve')
    && (verdict !== 'deny')
    && (verdict !== 'ask')) {
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
