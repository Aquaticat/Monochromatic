/**
 * Fixed-point propagation over direct effect summaries.
 *
 * @module
 */

import { propagateCallbackRelations, } from './effect-callback-relation.ts';
import { EffectPropagationError, } from './effect-propagation-error.ts';
import { propagateElementApplications, } from './effect-element-application.ts';
import { propagateInvokedCapabilities, } from './effect-invoked-capability.ts';
import { propagateCalleeIndexes, } from './effect-propagation-indexes.ts';
import type { MutableEffectSummary, } from './effect-summary-model.ts';
import { propagateUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';

/**
 * Mutable effect dimensions propagated per parameter.
 */
const EFFECT_DIMENSION_COUNT = 3;

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
  /* The bound counts the mutable effect bits, and those are not the only thing a pass can
   * report as progress: callback relations, element applications and uncertainty
   * provenance also set `changed` while contributing no counted bit. So the bound is a
   * runaway guard rather than a proof of convergence, and exhausting it means a summary
   * was still growing when the loop stopped. That summary is missing effects, which is
   * the direction that produces an offer for written state, so it is thrown rather than
   * returned. */
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
        // Read-only view members carry no summary, so their element flow
        // propagates per summary instead of along a call edge.
        state.changed = propagateElementApplications({
          summaries,
          summary,
        },) || state.changed;
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
            /* Mutation propagates for every affected callee index, including one the
             * callee also invokes. Subtracting the invoked set here cancelled real
             * writes, because one destructured object parameter gives every binding it
             * introduces the same index, so a callee calling one property and writing
             * another carried both facts on index zero. Order mattered too: whichever
             * of the two passes ran first decided the answer. */
            state.changed = propagateCalleeIndexes({
              target: summary.mutated,
              edge,
              calleeIndexes: calleeSummary.mutated,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.opaque,
              edge,
              calleeIndexes: calleeSummary.opaque,
            },) || state.changed;
            state.changed = propagateUncertaintyProvenance({
              summary,
              calleeSummary,
              edge,
              calleeIndexes: calleeSummary.opaque,
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
  if (state.changed)
    throw new EffectPropagationError({
      passCount: state.pass,
      effectBitCount,
      summaryCount: summaries.size,
    },);
}
