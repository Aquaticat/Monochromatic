/**
 * Stable policy-result fix summaries.
 *
 * @module
 */
import { Buffer, } from 'node:buffer';
import { createFixSummaryEvent, } from './events.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 * Appends one aggregate fix summary to stable policy result.
 *
 * @param result - final stable policy result
 *
 * @param trigger - fixable lifecycle point
 *
 * @param passes - changed candidate passes
 *
 * @param changedPaths - unique Git-byte-ordered paths
 *
 * @returns policy result with summary event
 *
 * @example
 * ```ts
 * withFixSummary({ result, trigger: 'direct-fix', passes: 1, changedPaths: ['a.txt'] });
 * ```
 */
export function withFixSummary({
  result,
  trigger,
  passes,
  changedPaths,
}: Readonly<{
  result: PolicyEngineResult;
  trigger: 'pre-forward' | 'direct-fix';
  passes: number;
  changedPaths: readonly string[];
}>,): PolicyEngineResult {
  return {
    ...result,
    events: [
      ...result.events,
      createFixSummaryEvent({
        sequence: result.events
          .length,
        trigger,
        passes,
        changedPaths: changedPaths.toSorted(function comparePathBytes(
          left,
          right,
        ) {
          return Buffer.compare(
            Buffer.from(left,),
            Buffer.from(right,),
          );
        },),
      },),
    ],
  };
}
