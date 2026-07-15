/**
 * Imported and global callable effect application.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import { NO_INTRINSIC_EFFECT, } from './intrinsic-effect-catalog.ts';
import { auditedCallableEffect, } from './effect-call-observation.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import {
  addOpaqueEffect,
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { addIntrinsicForwardedCallbackEffects, } from './effect-intrinsic-forwarded-callback.ts';
import { addIntrinsicInvocations, } from './effect-intrinsic-invocation.ts';
import { addIntrinsicPropertyInvocations, } from './effect-intrinsic-property-invocation.ts';
import { intrinsicTargetArguments, } from './intrinsic-target-arguments.ts';
import { targetMatchesCallArity, } from './effect-intrinsic-target-arity.ts';

/**
 * Applies exact non-method callable effect when cataloged.
 *
 * @param project - TypeScript project resolving callable provenance.
 *
 * @param checker - TypeScript checker resolving argument origins.
 *
 * @param bindingOriginBySymbolId - Current callable bindings to source parameters.
 *
 * @param call - Imported or global call candidate.
 *
 * @param summary - Current callable summary receiving mutations.
 *
 * @returns whether exact callable effect was cataloged.
 *
 * @mutates summary - Adds audited imported-call argument effects.
 *
 * @example
 * ```ts
 * applyAuditedCallableEffect({ project, checker, bindingOriginBySymbolId, call, summary });
 * ```
 */
export function applyAuditedCallableEffect({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  summary,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly summary: MutableEffectSummary;
},): boolean {
  /**
   * Exact imported or global callable effect when cataloged.
   */
  const callableEffect = auditedCallableEffect({
    project,
    checker,
    expression: call.expression,
  },);
  if (callableEffect === NO_INTRINSIC_EFFECT)
    return false;
  callableEffect.targets
    .forEach(function callableTarget(target,): void {
      if (!targetMatchesCallArity({
        target,
        call,
      },))
        return;
      intrinsicTargetArguments({
        call,
        target,
      },)
        .forEach(function callableArgument(argument,): void {
          parameterIndexes({
            checker,
            bindingOriginBySymbolId,
            node: argument,
            includedPropertyNames: (target.kind === 'receiver')
              || (target.propertyNames === undefined)
              ? ALL_PACKAGED_PROPERTIES
              : new Set(target.propertyNames,),
          },)
            .forEach(function addCallableMutation(index,): void {
              addEffectIndex({
                target: summary.directMutated,
                value: index,
              },);
            },);
        },);
    },);
  callableEffect.opaqueTargets
    ?.forEach(function opaqueCallableTarget(target,): void {
      if (!targetMatchesCallArity({
        target,
        call,
      },))
        return;
      intrinsicTargetArguments({
        call,
        target,
      },)
        .forEach(function opaqueCallableArgument(argument,): void {
          parameterIndexes({
            checker,
            bindingOriginBySymbolId,
            node: argument,
            includedPropertyNames: (target.kind === 'receiver')
              || (target.propertyNames === undefined)
              ? ALL_PACKAGED_PROPERTIES
              : new Set(target.propertyNames,),
          },)
            .forEach(function opaqueCallableOrigin(origin,): void {
              addOpaqueEffect({
                summary,
                affectedParameterIndex: origin,
                provenance: callableEffect.evidence,
              },);
            },);
        },);
    },);
  if (callableEffect.invokedArgumentIndexes !== undefined) {
    addIntrinsicInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      argumentIndexes: callableEffect.invokedArgumentIndexes,
      summary,
    },);
  }
  if (callableEffect.invokedArguments !== undefined) {
    /**
     * Actual number of arguments supplied by current call.
     */
    const { length: actualArgumentCount, } = call.arguments;
    /**
     * Argument positions invoked by overload matching current call arity.
     */
    const argumentIndexes = callableEffect.invokedArguments
      .filter(function matchingInvocationArity(invocation,): boolean {
        const { callArgumentCount, } = invocation;
        return (callArgumentCount === undefined)
          || (callArgumentCount === actualArgumentCount);
      },)
      .map(function invokedArgumentIndex(invocation,): number {
        return invocation.argumentIndex;
      },);
    addIntrinsicInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      argumentIndexes,
      summary,
    },);
  }
  if (callableEffect.invokedArgumentProperties !== undefined) {
    addIntrinsicPropertyInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      effects: callableEffect.invokedArgumentProperties,
      summary,
    },);
  }
  if (callableEffect.forwardedCallbacks !== undefined) {
    addIntrinsicForwardedCallbackEffects({
      checker,
      bindingOriginBySymbolId,
      call,
      effects: callableEffect.forwardedCallbacks,
      provenance: callableEffect.evidence,
      summary,
    },);
  }
  return true;
}
