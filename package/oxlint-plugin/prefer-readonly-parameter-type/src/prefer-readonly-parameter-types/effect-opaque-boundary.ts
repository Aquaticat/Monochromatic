/**
 * Opaque-boundary recording for a call no derivation could answer.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import { isPropertyAccessExpression, } from 'typescript/unstable/ast/is';
import type { Checker, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  parameterIndex,
} from './effect-call-resolution.ts';
import { effectCallName, } from './effect-call-name.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
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
 * @param checker - TypeScript checker resolving receiver and argument types.
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
 * recordOpaqueBoundary({ checker, bindingOriginBySymbolId, call, allArgumentIndexes, summary, receiverDerived: false, });
 * ```
 */
export function recordOpaqueBoundary({
  checker,
  bindingOriginBySymbolId,
  call,
  allArgumentIndexes,
  summary,
  receiverDerived,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly allArgumentIndexes: readonly (readonly number[])[];
  readonly summary: MutableEffectSummary;
  readonly receiverDerived: boolean;
},): void {
  /**
   * Authored unresolved call target retained for adapter verification.
   */
  const opaqueProvenance = effectCallName(call.expression,);
  /**
   * Origin call location naming where each remediation applies.
   */
  const originLocation = effectOriginLocation({ node: call, },);
  addOpaqueEffect({
    summary,
    affectedParameterIndex: (!receiverDerived)
      && isPropertyAccessExpression(call.expression,)
      && expressionCanCarryMutableState({
        checker,
        node: call.expression
          .expression,
      },)
      ? parameterIndex({
        checker,
        bindingOriginBySymbolId,
        node: call.expression
          .expression,
      },)
      : PARAMETER_INDEX_UNAVAILABLE,
    provenance: `${opaqueProvenance} [${originLocation}]`,
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
        affectedParameterIndex: index,
        provenance: `${opaqueProvenance} [${originLocation}]`,
      },);
    },);
  },);
}
