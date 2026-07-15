/**
 * Intrinsic callable effect application.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
  Type,
} from 'typescript/unstable/sync';

import { typeDefinitelyCallable, } from './effect-definitely-callable.ts';

import {
  addOpaqueEffect,
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { addIntrinsicCallbackEffects, } from './effect-intrinsic-callback.ts';
import { addIntrinsicForwardedCallbackEffects, } from './effect-intrinsic-forwarded-callback.ts';
import { addIntrinsicInvocations, } from './effect-intrinsic-invocation.ts';
import { addIntrinsicPropertyInvocations, } from './effect-intrinsic-property-invocation.ts';
import {
  expressionIsPlainData,
  receiverElementsArePlainData,
  typeIsPlainData,
} from './plain-data-classifier.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
  type PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { intrinsicTargetArguments, } from './intrinsic-target-arguments.ts';
import { targetMatchesCallArity, } from './effect-intrinsic-target-arity.ts';
import {
  intrinsicCallMatchesTypeConditions,
  intrinsicExpressionMatchesTypeCondition,
} from './effect-intrinsic-type-condition.ts';

/**
 * Applies one exact receiver intrinsic effect to current summary.
 *
 * @param project - TypeScript project resolving callback declarations.
 *
 * @param checker - TypeScript checker resolving argument origins.
 *
 * @param bindingOriginBySymbolId - Current bindings to source parameters.
 *
 * @param call - Exact intrinsic call.
 *
 * @param receiverType - Resolved intrinsic receiver type.
 *
 * @param receiverParameterIndex - Receiver origin in current callable.
 *
 * @param effect - Audited intrinsic effect.
 *
 * @param summary - Current callable summary receiving effects.
 *
 * @param foreignInbound - Foreign provenance callback bindings.
 *
 * @returns whether effect's receiver preconditions permitted application.
 *
 * @mutates summary - Adds receiver,
 * argument,
 * invocation,
 * callback relation,
 * and uncertainty effects.
 *
 * @example
 * ```ts
 * applyIntrinsicEffect({
 *   project,
 *   checker,
 *   bindingOriginBySymbolId,
 *   call,
 *   receiverType,
 *   receiverParameterIndex,
 *   effect,
 *   summary,
 *   foreignInbound,
 * });
 * ```
 */
export function applyIntrinsicEffect({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  receiverType,
  receiverParameterIndex,
  effect,
  summary,
  foreignInbound,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly receiverType: Type;
  readonly receiverParameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly effect: IntrinsicEffectEntry;
  readonly summary: MutableEffectSummary;
  readonly foreignInbound: boolean;
}): boolean {
  if ((effect.argumentTypeConditions !== undefined)
    && (!intrinsicCallMatchesTypeConditions({
      checker,
      call,
      conditions: effect.argumentTypeConditions,
    })))
    return false;
  if ((effect.requiresPlainReceiverElements === true)
    && (!receiverElementsArePlainData({
      checker,
      project,
      type: receiverType,
    })))
    return false;
  effect.targets
    .forEach(function intrinsicTarget(target,): void {
    if (!targetMatchesCallArity({
      target,
      call,
    },))
      return;
    if (target.kind === 'receiver') {
      /* Hook-only targets record traversal-invoked accessor uncertainty,
       * not proven mutation; statically plain data carries no hooks. */
      if ((target.traversalHookOnly === true)
        && typeIsPlainData({
          checker,
          project,
          type: receiverType,
        },))
        return;
      addEffectIndex({
        target: summary.directMutated,
        value: receiverParameterIndex,
      },);
      return;
    }
    intrinsicTargetArguments({
      call,
      target,
    },)
      .forEach(function intrinsicArgument(argument,): void {
        if ((target.typeCondition !== undefined)
          && (!intrinsicExpressionMatchesTypeCondition({
            checker,
            expression: argument,
            ...(target.propertyNames === undefined)
              ? {}
              : { propertyNames: target.propertyNames, },
            condition: target.typeCondition,
          })))
          return;
        if ((target.traversalHookOnly === true)
          && expressionIsPlainData({
            checker,
            project,
            node: argument,
          },))
          return;
        parameterIndexes({
          checker,
          bindingOriginBySymbolId,
          node: argument,
          includedPropertyNames: target.propertyNames === undefined
            ? ALL_PACKAGED_PROPERTIES
            : new Set(target.propertyNames,),
        },)
          .forEach(function intrinsicArgumentOrigin(origin,): void {
            addEffectIndex({
              target: summary.directMutated,
              value: origin,
            },);
          },);
      },);
  },);
  effect.opaqueTargets
    ?.forEach(function opaqueIntrinsicTarget(target,): void {
      if (!targetMatchesCallArity({
        target,
        call,
      },))
        return;
      if (target.kind === 'receiver') {
        /* Opaque targets record traversal-hook uncertainty, not proven
         * mutation; statically plain data carries no hooks to invoke. */
        if (typeIsPlainData({
          checker,
          project,
          type: receiverType,
        },))
          return;
        addOpaqueEffect({
          summary,
          affectedParameterIndex: receiverParameterIndex,
          provenance: effect.evidence,
        },);
        return;
      }
      intrinsicTargetArguments({
        call,
        target,
      },)
        .forEach(function opaqueIntrinsicArgument(argument,): void {
          if ((target.typeCondition !== undefined)
            && (!intrinsicExpressionMatchesTypeCondition({
              checker,
              expression: argument,
              ...(target.propertyNames === undefined)
                ? {}
                : { propertyNames: target.propertyNames, },
              condition: target.typeCondition,
            })))
            return;
          if (expressionIsPlainData({
            checker,
            project,
            node: argument,
          },))
            return;
          parameterIndexes({
            checker,
            bindingOriginBySymbolId,
            node: argument,
            includedPropertyNames: target.propertyNames === undefined
              ? ALL_PACKAGED_PROPERTIES
              : new Set(target.propertyNames,),
          },)
            .forEach(function opaqueIntrinsicOrigin(origin,): void {
              addOpaqueEffect({
                summary,
                affectedParameterIndex: origin,
                provenance: effect.evidence,
              },);
            },);
        },);
    },);
  /**
   * Comparator position whose absence or nullable type permits default coercion.
   */
  const coercionGuardArgumentIndex =
    effect.opaqueReceiverUnlessCallableArgumentOrPlainElements;
  if (coercionGuardArgumentIndex !== undefined) {
    /**
     * Comparator expression when supplied.
     */
    const comparator = call.arguments[coercionGuardArgumentIndex];
    /**
     * Semantic comparator type when expression resolves.
     */
    const comparatorType = comparator === undefined
      ? undefined
      : checker.getTypeAtLocation(comparator,);
    /**
     * Whether comparator is guaranteed callable rather than absent or nullish.
     */
    const comparatorIsDefinitelyCallable = (comparatorType !== undefined)
      && typeDefinitelyCallable({
        checker,
        type: comparatorType,
      },);
    if ((!comparatorIsDefinitelyCallable)
      && (!receiverElementsArePlainData({
        checker,
        project,
        type: receiverType,
      }))) {
      addOpaqueEffect({
        summary,
        affectedParameterIndex: receiverParameterIndex,
        provenance: effect.evidence,
      },);
    }
  }
  if (effect.invokedArgumentIndexes !== undefined) {
    addIntrinsicInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      argumentIndexes: effect.invokedArgumentIndexes,
      summary,
    },);
  }
  if (effect.invokedArguments !== undefined) {
    /**
     * Actual number of arguments supplied by current call.
     */
    const { length: actualArgumentCount, } = call.arguments;
    /**
     * Argument positions invoked by overload matching current call arity.
     */
    const argumentIndexes = effect.invokedArguments
      .filter(function matchingInvocationArity(invocation,): boolean {
        /**
         * Optional exact arity selecting invocation relation.
         */
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
  if (effect.invokedArgumentProperties !== undefined) {
    addIntrinsicPropertyInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      effects: effect.invokedArgumentProperties,
      summary,
    },);
  }
  if (effect.forwardedCallbacks !== undefined) {
    addIntrinsicForwardedCallbackEffects({
      checker,
      bindingOriginBySymbolId,
      call,
      effects: effect.forwardedCallbacks,
      provenance: effect.evidence,
      summary,
    },);
  }
  if (effect.callbacks !== undefined) {
    addIntrinsicCallbackEffects({
      project,
      checker,
      bindingOriginBySymbolId,
      call,
      receiverParameterIndex,
      callbackEffects: effect.callbacks,
      summary,
      foreignInbound,
    },);
  }
  return true;
}
