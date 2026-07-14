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

import {
  addOpaqueEffect,
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { addIntrinsicCallbackEffects, } from './effect-intrinsic-callback.ts';
import { addIntrinsicForwardedCallbackEffects, } from './effect-intrinsic-forwarded-callback.ts';
import { addIntrinsicInvocations, } from './effect-intrinsic-invocation.ts';
import { receiverElementsArePrimitive, } from './effect-primitive-origin.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
  type PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import type { IntrinsicEffectEntry, } from './intrinsic-effect-catalog.ts';
import { intrinsicTargetArguments, } from './intrinsic-target-arguments.ts';

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
  if ((effect.requiresPrimitiveReceiverElements === true)
    && (!receiverElementsArePrimitive({
      checker,
      type: receiverType,
    })))
    return false;
  effect.targets
    .forEach(function intrinsicTarget(target,): void {
    if (target.kind === 'receiver') {
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
      if (target.kind === 'receiver') {
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
  if (effect.invokedArgumentIndexes !== undefined) {
    addIntrinsicInvocations({
      checker,
      bindingOriginBySymbolId,
      call,
      argumentIndexes: effect.invokedArgumentIndexes,
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
