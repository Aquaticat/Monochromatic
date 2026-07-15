/**
 * Owned callback-argument effect propagation.
 *
 * @module
 */

import {
  addEffectIndex,
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
    const callbackKey = edge.callbackKeys[relation.callbackParameterIndex];
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
    const sourceCallerIndexes = edge.arguments[relation.sourceParameterIndex]
      ?? [];
    /**
     * Whether callback argument carries proven mutation.
     */
    const callbackArgumentMutated = callbackSummary.mutated
      .has(relation.callbackArgumentIndex,);
    /**
     * Whether callback argument carries unresolved uncertainty.
     */
    const callbackArgumentOpaque = callbackSummary.opaque
      .has(relation.callbackArgumentIndex,);
    /**
     * Whether callback argument carries documented uncertainty.
     */
    const callbackArgumentDocumented = callbackSummary.documentedUncertain
      .has(relation.callbackArgumentIndex,);
    for (const sourceCallerIndex of sourceCallerIndexes) {
      /**
       * Whether mutation propagation changed caller summary.
       */
      const mutationChanged = callbackArgumentMutated
        && addEffectIndex({
          target: summary.mutated,
          value: sourceCallerIndex,
        },);
      /**
       * Whether opaque propagation changed caller summary.
       */
      const opaqueChanged = callbackArgumentOpaque
        && addEffectIndex({
          target: summary.opaque,
          value: sourceCallerIndex,
        },);
      /**
       * Whether documented uncertainty changed caller summary.
       */
      const documentedChanged = callbackArgumentDocumented
        && addEffectIndex({
          target: summary.documentedUncertain,
          value: sourceCallerIndex,
        },);
      /**
       * Whether callback uncertainty provenance changed caller summary.
       */
      const provenanceChanged = (callbackArgumentOpaque || callbackArgumentDocumented)
        && addUncertaintyProvenance({
          target: summary.opaqueProvenanceByParameter,
          parameterIndex: sourceCallerIndex,
          provenanceFacts: callbackSummary.opaqueProvenanceByParameter
            .get(relation.callbackArgumentIndex,)
            ?? new Set<string>(),
        },);
      changed = mutationChanged
        || opaqueChanged
        || documentedChanged
        || provenanceChanged
        || changed;
    }
  }
  return changed;
}
