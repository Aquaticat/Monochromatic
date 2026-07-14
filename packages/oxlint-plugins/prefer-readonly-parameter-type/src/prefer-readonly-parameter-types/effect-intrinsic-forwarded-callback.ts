/**
 * Intrinsic forwarded callback argument relations.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type { Checker, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  ALL_PACKAGED_PROPERTIES,
  parameterIndex,
  parameterIndexes,
} from './effect-call-resolution.ts';
import {
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import type { IntrinsicForwardedCallbackEffect, } from './intrinsic-effect-catalog.ts';

/**
 * Adds unresolved callback-to-forwarded-argument relations.
 *
 * @param checker - TypeScript checker resolving source parameters.
 *
 * @param bindingOriginBySymbolId - Current bindings to source parameters.
 *
 * @param call - Exact intrinsic call.
 *
 * @param effects - Callback and forwarded argument positions.
 *
 * @param provenance - Audited intrinsic evidence for diagnostics.
 *
 * @param summary - Current callable summary receiving relations and uncertainty.
 *
 * @mutates summary - Adds callback relations and source uncertainty without claiming proven mutation.
 *
 * @example
 * ```ts
 * addIntrinsicForwardedCallbackEffects({
 *   checker,
 *   bindingOriginBySymbolId,
 *   call,
 *   effects,
 *   provenance,
 *   summary,
 * });
 * ```
 */
export function addIntrinsicForwardedCallbackEffects({
  checker,
  bindingOriginBySymbolId,
  call,
  effects,
  provenance,
  summary,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly effects: readonly IntrinsicForwardedCallbackEffect[];
  readonly provenance: string;
  readonly summary: MutableEffectSummary;
}): void {
  effects.forEach(function forwardedCallback(effect,): void {
    /**
     * Callback expression receiving forwarded arguments.
     */
    const callback = call.arguments[effect.callbackArgumentIndex];
    if (callback === undefined)
      return;
    /**
     * Callback parameter index when callable itself enters current function.
     */
    const callbackParameterIndex = parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: callback,
    },);
    call.arguments
      .slice(effect.sourceArgumentStartIndex,)
      .forEach(function forwardedArgument(
        argument,
        callbackArgumentIndex,
      ): void {
        parameterIndexes({
          checker,
          bindingOriginBySymbolId,
          node: argument,
          includedPropertyNames: ALL_PACKAGED_PROPERTIES,
        },)
          .forEach(function forwardedSource(sourceParameterIndex,): void {
            addOpaqueEffect({
              summary,
              affectedParameterIndex: sourceParameterIndex,
              provenance,
            },);
            if (callbackParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
              return;
            summary.relations
              .push({
              callbackParameterIndex,
              callbackArgumentIndex,
              sourceParameterIndex,
            },);
          },);
      },);
  },);
}
