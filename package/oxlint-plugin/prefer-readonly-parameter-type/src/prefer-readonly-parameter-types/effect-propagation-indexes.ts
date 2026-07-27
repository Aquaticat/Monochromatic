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
 * Propagation only ever adds. An earlier revision let the caller pass callee indexes to
 * skip, and mutation propagation passed the callee's invoked set, so a callee that both
 * invoked and mutated through one parameter index cancelled its own mutation. A single
 * destructured object parameter makes that the ordinary case rather than a curiosity,
 * because every binding it introduces shares index zero: a callee taking `{ run, target }`
 * that calls `run` and writes `target` recorded both facts against index zero, and the
 * write never reached the caller. `invokedExclusionDirectEffect` in the result-provenance
 * fixture measures it. Distinguishing the two needs per-property effects, and until those
 * exist an effect can only be dropped by not recording it.
 *
 * @param target - Caller effect set receiving propagated index.
 *
 * @param edge - Call edge with caller argument roots.
 *
 * @param calleeIndexes - Callee parameter indexes carrying effect.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds caller indexes affected by callee effects.
 *
 * @example
 * ```ts
 * propagateCalleeIndexes({ target, edge, calleeIndexes });
 * ```
 */
export function propagateCalleeIndexes({
  target,
  edge,
  calleeIndexes,
}: {
  readonly target: Set<number>;
  readonly edge: CallEdge;
  readonly calleeIndexes: ReadonlySet<number>;
},): boolean {
  /**
   * Whether any caller effect index was added.
   */
  let changed = false;
  for (const calleeIndex of calleeIndexes) {
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
