/**
 * Element-flow effect propagation for read-only view receivers.
 *
 * @module
 */

import {
  parameterCarriesSlot,
  provenanceOfParameter,
} from './effect-slot-projection.ts';
import {
  addEffectSlot,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { addUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';

/**
 * Propagates observer effects from read-only view elements to their receiver.
 *
 * Runs per summary rather than per call edge, because the member handing state
 * to the observer belongs to the default library and therefore never has a
 * summary of its own for an edge to point at.
 *
 * An observer that mutates receiver-reachable state marks the receiver mutated,
 * matching how the same mutation surfaces when it reaches the observer through
 * an owned callee instead. One that leaves such state unresolved marks the
 * receiver opaque and carries the provenance, so the diagnostic still names the
 * call that could not be derived.
 *
 * @param summaries - Owned callable summaries by declaration key.
 *
 * @param summary - Caller summary receiving observer effects.
 *
 * @returns whether caller summary changed.
 *
 * @mutates summary - Adds receiver mutation and uncertainty effects.
 *
 * @example
 * ```ts
 * propagateElementApplications({ summaries, summary });
 * ```
 */
export function propagateElementApplications({
  summaries,
  summary,
}: {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly summary: MutableEffectSummary;
},): boolean {
  /**
   * Whether any observer effect changed caller summary.
   */
  let changed = false;
  for (const application of summary.elementApplications) {
    /**
     * Summary for the owned observer passed to the read-only view member.
     */
    const observerSummary = summaries.get(application.callbackKey,);
    if (observerSummary === undefined)
      continue;
    for (const parameterIndex of application.observerParameterIndexes) {
      /* Positions here name observer parameters, not observer slots. An observer that
       * destructures its element records writes against property slots, so its slot sets
       * are projected before being asked, exactly as callback relations are. */
      /**
       * Whether observer mutates receiver-reachable state at this position.
       */
      const observerMutated = parameterCarriesSlot({
        ownership: observerSummary.slots,
        slots: observerSummary.mutated,
        parameterIndex,
      },);
      /**
       * Whether observer leaves receiver-reachable state unresolved here.
       */
      const observerOpaque = parameterCarriesSlot({
        ownership: observerSummary.slots,
        slots: observerSummary.opaque,
        parameterIndex,
      },);
      /**
       * Whether mutation propagation changed caller summary.
       */
      const mutationChanged = observerMutated
        && addEffectSlot({
          target: summary.mutated,
          value: application.receiverSlot,
        },);
      /**
       * Whether opaque propagation changed caller summary.
       */
      const opaqueChanged = observerOpaque
        && addEffectSlot({
          target: summary.opaque,
          value: application.receiverSlot,
        },);
      /**
       * Whether observer uncertainty provenance changed caller summary.
       */
      const provenanceChanged = observerOpaque
        && addUncertaintyProvenance({
          target: summary.opaqueProvenanceBySlot,
          affectedSlot: application.receiverSlot,
          provenanceFacts: provenanceOfParameter({
            ownership: observerSummary.slots,
            provenanceBySlot: observerSummary.opaqueProvenanceBySlot,
            parameterIndex,
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
