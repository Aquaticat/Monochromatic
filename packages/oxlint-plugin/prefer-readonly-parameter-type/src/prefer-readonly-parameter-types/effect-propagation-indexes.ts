/**
 * Generic caller-index propagation across owned call edge.
 *
 * @module
 */

import {
  addEffectIndex,
  type CallEdge,
} from './effect-summary-model.ts';

/**
 * Maps callee parameter effects through one call edge.
 *
 * @param target - Caller effect set receiving propagated index.
 *
 * @param edge - Call edge with caller argument roots.
 *
 * @param calleeIndexes - Callee parameter indexes carrying effect.
 *
 * @param excludedIndexes - Callee indexes propagated through specialized relation.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds caller indexes affected by callee effects.
 *
 * @example
 * ```ts
 * propagateCalleeIndexes({ target, edge, calleeIndexes, excludedIndexes });
 * ```
 */
export function propagateCalleeIndexes({
  target,
  edge,
  calleeIndexes,
  excludedIndexes,
}: {
  readonly target: Set<number>;
  readonly edge: CallEdge;
  readonly calleeIndexes: ReadonlySet<number>;
  readonly excludedIndexes: ReadonlySet<number>;
},): boolean {
  /**
   * Whether any caller effect index was added.
   */
  let changed = false;
  for (const calleeIndex of calleeIndexes) {
    if (excludedIndexes.has(calleeIndex,))
      continue;
    /**
     * Caller parameters packaged into affected callee parameter.
     */
    const callerIndexes = edge.arguments[calleeIndex] ?? [];
    for (const callerIndex of callerIndexes) {
      changed = addEffectIndex({
        target,
        value: callerIndex,
      },) || changed;
    }
  }
  return changed;
}
