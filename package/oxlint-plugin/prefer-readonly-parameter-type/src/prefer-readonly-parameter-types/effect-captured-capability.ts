/**
 * Caller opacity for a callable handed to a callee that could not account for it.
 *
 * The admission gate is the callee's own uncertainty about the formal, not the reason for it.
 * Gating on retention provenance was considered and rejected as unsound: absent retention
 * provenance means call-caused or unknown rather than proven non-retaining, so a callee
 * forwarding its callback to something this analysis cannot resolve would pass the gate while
 * the unresolved callee kept the callable and invoked it later.
 *
 * ```ts
 * function relay(callback: () => Row,): void {
 *   unresolved(callback,);
 * }
 * ```
 *
 * `relay` records call-caused opacity for its formal and no retention, and a caller handing it
 * a capturing closure has to withhold all the same.
 *
 * The provenance the caller receives is the callee's own, copied unchanged, which is what
 * makes the two cases read differently at the boundary without a second decision here. A
 * capture reaching a callee that stored it arrives with store provenance and stays silent,
 * because a reader cannot act on it. One reaching a callee that could not inspect its own
 * callee arrives with that call named, which is exactly what the reader can act on.
 *
 * @module
 */

import { addUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';
import {
  addEffectSlot,
  type CallEdge,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';

/**
 * Provenance facts carried by nothing, shared so an absent entry allocates no set.
 */
const NO_PROVENANCE_FACTS: ReadonlySet<string> = new Set<string>();

/**
 * Origins carried by nothing, shared so a formal packaging no callable allocates none.
 */
const NO_CAPTURED_ORIGINS: readonly EffectSlot[] = [];

/**
 * Marks caller origins opaque when a callable they were captured by reached an uncertain formal.
 *
 * @param summary - Caller summary receiving opacity.
 *
 * @param calleeSummary - Callee summary supplying uncertainty and its provenance.
 *
 * @param edge - Owned call edge carrying captures per formal.
 *
 * @mutates summary - Adds opaque slots and copies callee provenance onto them.
 *
 * @returns whether any caller fact grew.
 *
 * @example
 * ```ts
 * propagateCapturedCapability({ summary, calleeSummary, edge });
 * ```
 */
export function propagateCapturedCapability({
  summary,
  calleeSummary,
  edge,
}: {
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  /**
   * Whether any caller opacity or provenance fact was added.
   */
  const growth: { any: boolean; } = { any: false, };
  calleeSummary.opaque
    .forEach(function propagateSlot(calleeSlot,): void {
      /**
       * Formal owning this callee slot, since a capture fills a whole formal.
       */
      const owner = calleeSummary.slots
        .parameterOfSlot[calleeSlot];
      if (owner === undefined)
        return;
      /**
       * Origins the callable filling that formal captured.
       */
      const captured = edge.capturedOriginsByFormal[owner] ?? NO_CAPTURED_ORIGINS;
      if (captured.length === 0)
        return;
      /**
       * Provenance the callee attached to its own uncertainty about this slot.
       */
      const provenanceFacts = calleeSummary.opaqueProvenanceBySlot
        .get(calleeSlot,)
        ?? NO_PROVENANCE_FACTS;
      captured.forEach(function markCaptured(origin,): void {
        if (addEffectSlot({
          target: summary.opaque,
          value: origin,
        },))
          growth.any = true;
        if (addUncertaintyProvenance({
          target: summary.opaqueProvenanceBySlot,
          affectedSlot: origin,
          provenanceFacts,
        },))
          growth.any = true;
      },);
    },);
  return growth.any;
}

/**
 * Marks every capture on an edge opaque when the callee has no summary at all.
 *
 * The unresolved-callee branch already takes opacity for every ordinary origin an edge
 * packages, on the reasoning that a callable which could not be built proves nothing. A
 * capture is in exactly that position and was not covered, so an owned edge whose summary
 * failed to build kept the same false offer this work removed everywhere else.
 *
 * @param summary - Caller summary receiving opacity.
 *
 * @param edge - Owned call edge whose callee has no summary.
 *
 * @mutates summary - Adds opaque slots and names the missing summary as their cause.
 *
 * @returns whether any caller fact grew.
 *
 * @example
 * ```ts
 * markCapturedCapabilityUnresolved({ summary, edge });
 * ```
 */
export function markCapturedCapabilityUnresolved({
  summary,
  edge,
}: {
  readonly summary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  /**
   * Whether any caller opacity or provenance fact was added.
   */
  const growth: { any: boolean; } = { any: false, };
  /**
   * Cause named for every capture handed to a callable with no summary.
   */
  const provenanceFacts: ReadonlySet<string> = new Set([
    `callable without an effect summary ${edge.calleeKey}`,
  ],);
  edge.capturedOriginsByFormal
    .forEach(function markFormal(captured,): void {
      captured.forEach(function markCaptured(origin,): void {
        if (addEffectSlot({
          target: summary.opaque,
          value: origin,
        },))
          growth.any = true;
        if (addUncertaintyProvenance({
          target: summary.opaqueProvenanceBySlot,
          affectedSlot: origin,
          provenanceFacts,
        },))
          growth.any = true;
      },);
    },);
  return growth.any;
}
