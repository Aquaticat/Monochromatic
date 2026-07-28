/**
 * Uncertain effect provenance propagation across owned calls.
 *
 * @module
 */

import type { EffectSlot, } from './effect-slot-identity.ts';
import { calleeSlotOrigins, } from './effect-slot-projection.ts';
import {
  type CallEdge,
  type MutableEffectSummary,
  EFFECT_SLOT_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Adds uncertainty provenance facts for one caller parameter.
 *
 * @param target - Caller provenance map receiving facts.
 *
 * @param affectedSlot - Caller slot affected by uncertain boundary.
 *
 * @param provenanceFacts - Callee provenance facts to propagate.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds previously unseen uncertainty provenance facts.
 *
 * @example
 * ```ts
 * addUncertaintyProvenance({ target, affectedSlot, provenanceFacts });
 * ```
 */
export function addUncertaintyProvenance({
  target,
  affectedSlot,
  provenanceFacts,
}: {
  readonly target: Map<EffectSlot, Set<string>>;
  readonly affectedSlot: EffectSlot | typeof EFFECT_SLOT_UNAVAILABLE;
  readonly provenanceFacts: ReadonlySet<string>;
},): boolean {
  if (affectedSlot === EFFECT_SLOT_UNAVAILABLE)
    return false;
  /**
   * Existing caller provenance or new accumulator.
   */
  const callerFacts = target.get(affectedSlot,) ?? new Set<string>();
  /**
   * Size before union detects fixed-point progress.
   */
  const priorSize = callerFacts.size;
  provenanceFacts.forEach(function add(provenance,): void {
    callerFacts.add(provenance,);
  },);
  target.set(
    affectedSlot,
    callerFacts,
  );
  return callerFacts.size !== priorSize;
}

/**
 * Maps opaque or documented uncertainty provenance through one owned call edge.
 *
 * @param summary - Caller summary receiving provenance.
 *
 * @param calleeSummary - Callee summary providing provenance facts.
 *
 * @param edge - Caller-to-callee argument mapping.
 *
 * @param calleeIndexes - Callee parameters carrying uncertain effects.
 *
 * @returns whether caller provenance changed.
 *
 * @mutates summary - Adds caller uncertainty provenance inherited from callee.
 *
 * @example
 * ```ts
 * propagateUncertaintyProvenance({ summary, calleeSummary, edge, calleeIndexes });
 * ```
 */
export function propagateUncertaintyProvenance({
  summary,
  calleeSummary,
  edge,
  calleeIndexes,
}: {
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
  readonly calleeIndexes: ReadonlySet<EffectSlot>;
},): boolean {
  /**
   * Whether any caller provenance fact was added.
   */
  let changed = false;
  for (const calleeIndex of calleeIndexes) {
    /**
     * Caller parameters packaged into uncertain callee parameter.
     */
    const callerIndexes = calleeSlotOrigins({
      edge,
      ownership: calleeSummary.slots,
      slot: calleeIndex,
    },);
    /**
     * Provenance facts attached to uncertain callee parameter.
     */
    const provenanceFacts = calleeSummary.opaqueProvenanceBySlot
      .get(calleeIndex,)
      ?? new Set<string>();
    for (const callerIndex of callerIndexes) {
      changed = addUncertaintyProvenance({
        target: summary.opaqueProvenanceBySlot,
        affectedSlot: callerIndex,
        provenanceFacts,
      },) || changed;
    }
  }
  return changed;
}
