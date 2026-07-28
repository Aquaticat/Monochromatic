/**
 * Owned callback-argument effect propagation.
 *
 * @module
 */

import { asParameterIndex, } from './effect-slot-identity.ts';
import {
  calleeSlotOrigins,
  parameterCarriesSlot,
  provenanceOfParameter,
} from './effect-slot-projection.ts';
import {
  addEffectSlot,
  type CallEdge,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import { addUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';

/**
 * Propagates callback argument effects through one owned call edge.
 *
 * @param summaries - Owned callable summaries by declaration key.
 *
 * @param summary - Caller summary receiving callback effects.
 *
 * @param calleeSummary - Callee summary defining callback relations.
 *
 * @param edge - Caller-to-callee argument edge.
 *
 * @returns whether caller summary changed.
 *
 * @mutates summary - Adds callback mutation and uncertainty effects.
 *
 * @example
 * ```ts
 * propagateCallbackRelations({ summaries, summary, calleeSummary, edge });
 * ```
 */
export function propagateCallbackRelations({
  summaries,
  summary,
  calleeSummary,
  edge,
}: {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  /**
   * Whether any callback effect changed caller summary.
   */
  let changed = false;
  for (const relation of calleeSummary.relations) {
    /**
     * Callback declaration key passed to callback parameter.
     */
    const callbackKey = edge.callbackKeysByCalleeSlot[relation.callbackSlot];
    if ((callbackKey === undefined)
      || (callbackKey === OWNED_CALLABLE_UNAVAILABLE))
      continue;
    /**
     * Summary for passed callback declaration.
     */
    const callbackSummary = summaries.get(callbackKey,);
    if (callbackSummary === undefined)
      continue;
    /**
     * Caller parameters packaged as callback source value.
     */
    const sourceCallerIndexes = calleeSlotOrigins({
      edge,
      ownership: calleeSummary.slots,
      slot: relation.sourceSlot,
    },);
    /* The relation names a syntactic argument position of the inner invocation, which is a
     * parameter position of the callback, not a slot of it. A callback that destructures
     * that parameter records its writes against property slots, so asking its slot sets
     * directly would answer `false` and drop the write. Projecting to parameters first keeps
     * the answer sound; carrying property precision through a callback would need the
     * relation to name a slot on both sides, which it does not yet. */
    /**
     * Callback parameter this relation's argument position fills.
     */
    const callbackParameter = asParameterIndex(relation.callbackArgumentPosition,);
    /**
     * Whether callback argument carries proven mutation.
     */
    const callbackArgumentMutated = parameterCarriesSlot({
      ownership: callbackSummary.slots,
      slots: callbackSummary.mutated,
      parameterIndex: callbackParameter,
    },);
    /**
     * Whether callback argument carries unresolved uncertainty.
     */
    const callbackArgumentOpaque = parameterCarriesSlot({
      ownership: callbackSummary.slots,
      slots: callbackSummary.opaque,
      parameterIndex: callbackParameter,
    },);
    for (const sourceCallerIndex of sourceCallerIndexes) {
      /**
       * Whether mutation propagation changed caller summary.
       */
      const mutationChanged = callbackArgumentMutated
        && addEffectSlot({
          target: summary.mutated,
          value: sourceCallerIndex,
        },);
      /**
       * Whether opaque propagation changed caller summary.
       */
      const opaqueChanged = callbackArgumentOpaque
        && addEffectSlot({
          target: summary.opaque,
          value: sourceCallerIndex,
        },);
      /**
       * Whether callback uncertainty provenance changed caller summary.
       */
      const provenanceChanged = callbackArgumentOpaque
        && addUncertaintyProvenance({
          target: summary.opaqueProvenanceBySlot,
          affectedSlot: sourceCallerIndex,
          provenanceFacts: provenanceOfParameter({
            ownership: callbackSummary.slots,
            provenanceBySlot: callbackSummary.opaqueProvenanceBySlot,
            parameterIndex: callbackParameter,
          },),
        },);
      changed = mutationChanged
        || opaqueChanged
        || provenanceChanged
        || changed;
    }
  }
  return changed;
}
