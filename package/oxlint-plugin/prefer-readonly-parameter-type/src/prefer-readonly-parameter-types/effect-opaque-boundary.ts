/**
 * Opaque-boundary recording for a call no derivation could answer.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  addOpaqueEffect,
  rootParameterOrigins,
} from './effect-call-resolution.ts';
import { effectCallName, } from './effect-call-name.ts';
import {
  memberCallReceiver,
  NO_MEMBER_RECEIVER,
} from './effect-member-call-receiver.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  type MutableEffectSummary,
  NO_SLOT_ORIGIN,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records the receiver and argument opacity an unresolved call leaves behind.
 *
 * The two sides are separate obligations, which is why they are separate parameters
 * rather than one "did it derive" answer. A verified narrow member discharges what
 * the call does to its receiver and says nothing about where its arguments end up:
 * `values.with(0, replacement)` reaches no user code and still places `replacement`
 * inside the array it returns. An earlier attempt discharged both at once with a
 * single early return, which silently stopped reporting that escape.
 *
 * @param project - TypeScript project resolving receiver and argument types.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param call - Call expression no derivation could answer.
 *
 * @param allArgumentIndexes - Caller parameter roots per call argument.
 *
 * @param summary - Caller summary receiving opacity facts.
 *
 * @param receiverDerived - Whether the receiver claim is already answered.
 *
 * @mutates summary - Adds opaque parameter indexes and their provenance.
 *
 * @example
 * ```ts
 * recordOpaqueBoundary({ project, bindingOriginBySymbolId, call, allArgumentIndexes, summary, receiverDerived: false, });
 * ```
 */
export function recordOpaqueBoundary({
  project,
  bindingOriginBySymbolId,
  call,
  allArgumentIndexes,
  summary,
  receiverDerived,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly call: CallExpression;
  readonly allArgumentIndexes: readonly (readonly EffectSlot[])[];
  readonly summary: MutableEffectSummary;
  readonly receiverDerived: boolean;
},): void {
  /**
   * Checker for the project resolving this call.
   */
  const { checker, } = project;
  /**
   * Authored unresolved call target retained for adapter verification.
   */
  const opaqueProvenance = effectCallName(call.expression,);
  /**
   * Origin call location naming where each remediation applies.
   */
  const originLocation = effectOriginLocation({ node: call, },);
  /**
   * Expression the call was made on, however the member was named.
   */
  const callReceiver = memberCallReceiver({ call, },);
  /**
   * Whether an unanswered receiver claim still carries caller-reachable state.
   */
  const receiverClaimOutstanding = (!receiverDerived)
    && (callReceiver !== NO_MEMBER_RECEIVER)
    && expressionCanCarryMutableState({
      checker,
      node: callReceiver,
    },);
  /**
   * Caller parameters the unresolved receiver can hold.
   */
  const receiverOrigins: SlotOrigins = receiverClaimOutstanding
    ? rootParameterOrigins({
      project,
      bindingOriginBySymbolId,
      node: callReceiver,
    },)
    : NO_SLOT_ORIGIN;
  receiverOrigins.forEach(function opaqueReceiverOrigin(index,): void {
    addOpaqueEffect({
      summary,
      affectedSlot: index,
      provenance: `${opaqueProvenance} [${originLocation}]`,
    },);
  },);
  allArgumentIndexes.forEach(function opaqueArgument(
    indexes,
    argumentIndex,
  ): void {
    /**
     * Argument expression corresponding to indexed parameter origin.
     */
    const argument = call.arguments[argumentIndex];
    if ((argument === undefined)
      || (!expressionCanCarryMutableState({
        checker,
        node: argument,
      },)))
      return;
    indexes.forEach(function opaqueArgumentOrigin(index,): void {
      addOpaqueEffect({
        summary,
        affectedSlot: index,
        provenance: `${opaqueProvenance} [${originLocation}]`,
      },);
    },);
  },);
}
