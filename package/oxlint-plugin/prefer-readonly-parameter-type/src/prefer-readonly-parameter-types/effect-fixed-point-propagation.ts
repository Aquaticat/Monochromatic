/**
 * Fixed-point propagation over direct effect summaries.
 *
 * @module
 */

import { propagateCallbackRelations, } from './effect-callback-relation.ts';
import { propagateInvokedCapabilities, } from './effect-invoked-capability.ts';
import { propagateCalleeIndexes, } from './effect-propagation-indexes.ts';
import type { MutableEffectSummary, } from './effect-summary-model.ts';
import { propagateUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';

/**
 * Mutable effect dimensions propagated per parameter.
 */
const EFFECT_DIMENSION_COUNT = 4;

/**
 * Empty exclusion set for ordinary effect propagation.
 */
const NO_EXCLUDED_EFFECT_INDEXES: ReadonlySet<number> = new Set();

/**
 * Propagates direct, transitive, recursive, and higher-order effects to fixed point.
 *
 * @param summaries - Mutable summaries keyed by declaration.
 *
 * @mutates summaries - Propagates call effects to fixed point.
 *
 * @example
 * ```ts
 * propagateEffects(summaries);
 * ```
 */
export function propagateEffects(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): void {
  /**
   * Total effect bits that can change before fixed point.
   */
  const effectBitCount = [...summaries.values(),].reduce(
    function total(
    totalCount,
    summary,
  ): number {
    return totalCount + (summary.parameterCount * EFFECT_DIMENSION_COUNT);
  },
    0,
  );
  /**
   * Mutable convergence state shared across each propagation pass.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed && (state.pass <= effectBitCount)) {
    state.changed = false;
    state.pass++;
    summaries.forEach(
      /**
       * Propagates every owned call edge from one caller summary.
       *
       * @param summary - Caller summary receiving transitive effects.
       *
       * @mutates summary - Adds callee and callback effects.
       */
      function propagateSummary(summary,): void {
        summary.calls
          .forEach(function propagateCall(edge,): void {
            /**
             * Summary for owned callee edge.
             */
            const calleeSummary = summaries.get(edge.calleeKey,);
            if (calleeSummary === undefined)
              return;
            state.changed = propagateInvokedCapabilities({
              summaries,
              summary,
              calleeSummary,
              edge,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.mutated,
              edge,
              calleeIndexes: calleeSummary.mutated,
              excludedIndexes: calleeSummary.invoked,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.opaque,
              edge,
              calleeIndexes: calleeSummary.opaque,
              excludedIndexes: NO_EXCLUDED_EFFECT_INDEXES,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.documentedUncertain,
              edge,
              calleeIndexes: calleeSummary.documentedUncertain,
              excludedIndexes: NO_EXCLUDED_EFFECT_INDEXES,
            },) || state.changed;
            state.changed = propagateUncertaintyProvenance({
              summary,
              calleeSummary,
              edge,
              calleeIndexes: calleeSummary.opaque,
            },) || state.changed;
            state.changed = propagateUncertaintyProvenance({
              summary,
              calleeSummary,
              edge,
              calleeIndexes: calleeSummary.documentedUncertain,
            },) || state.changed;
            state.changed = propagateCallbackRelations({
              summaries,
              summary,
              calleeSummary,
              edge,
            },) || state.changed;
          },);
      },);
  }
}
