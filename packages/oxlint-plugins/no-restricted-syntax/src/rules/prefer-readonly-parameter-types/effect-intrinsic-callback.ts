/**
 * Audited intrinsic callback-effect recording.
 *
 * @module
 */

import type { Checker, Project, } from 'typescript/unstable/sync';
import type { CallExpression, } from 'typescript/unstable/ast';

import type { IntrinsicCallbackEffect, } from './intrinsic-effect-catalog.ts';
import {
  callableKey,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import {
  addOpaqueEffect,
  callableDeclaration,
  parameterIndex,
} from './effect-call-resolution.ts';

/**
 * Records callback effects declared by audited intrinsic operation.
 *
 * @param project - TypeScript project resolving callback declarations.
 *
 * @param checker - TypeScript checker resolving callback parameter origins.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param call - Intrinsic call carrying callback argument.
 *
 * @param receiverParameterIndex - Current parameter owning intrinsic receiver.
 *
 * @param callbackEffects - Audited callback-to-receiver relationships.
 *
 * @param summary - Current callable summary receiving callback edges.
 *
 * @mutates summary - Adds owned calls, higher-order relations, or opaque callback provenance.
 *
 * @example
 * ```ts
 * addIntrinsicCallbackEffects({
 *   project,
 *   checker,
 *   bindingOriginBySymbolId,
 *   call,
 *   receiverParameterIndex,
 *   callbackEffects,
 *   summary,
 * });
 * ```
 */
export function addIntrinsicCallbackEffects({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  receiverParameterIndex,
  callbackEffects,
  summary,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly receiverParameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly callbackEffects: readonly IntrinsicCallbackEffect[];
  readonly summary: MutableEffectSummary;
},): void {
  if (receiverParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return;
  callbackEffects.forEach(function intrinsicCallbackEffect(callbackEffect,): void {
    /**
     * Callback expression at audited intrinsic argument position.
     */
    const callbackArgument = call.arguments[callbackEffect.argumentIndex];
    if (callbackArgument === undefined)
      return;
    /**
     * Current higher-order callback parameter passed into intrinsic.
     */
    const callbackParameterIndex = parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: callbackArgument,
    },);
    if (callbackParameterIndex !== PARAMETER_INDEX_UNAVAILABLE) {
      callbackEffect.receiverParameterIndexes
        .forEach(function callbackRelation(
          callbackArgumentIndex,
        ): void {
          summary.relations
            .push({
              callbackParameterIndex,
              callbackArgumentIndex,
              sourceParameterIndex: receiverParameterIndex,
            },);
        },);
      return;
    }
    /**
     * Owned callback declaration receiving receiver-reachable values.
     */
    const callback = callableDeclaration({
      project,
      node: callbackArgument,
    },);
    if (callback === OWNED_CALLABLE_UNAVAILABLE) {
      addOpaqueEffect({
        summary,
        affectedParameterIndex: receiverParameterIndex,
        provenance: `${call.expression
          .getText()} callback`,
      },);
      return;
    }
    /**
     * Callback parameter positions receiving receiver-reachable values.
     */
    const receiverIndexes = new Set(callbackEffect.receiverParameterIndexes,);
    summary.calls
      .push({
        calleeKey: callableKey(callback,),
        arguments: callback.parameters
          .map(function callbackSource(
            _parameter,
            callbackArgumentIndex,
          ): number | typeof PARAMETER_INDEX_UNAVAILABLE {
            return receiverIndexes.has(callbackArgumentIndex,)
              ? receiverParameterIndex
              : PARAMETER_INDEX_UNAVAILABLE;
          },),
        callbackKeys: callback.parameters
          .map(function noNestedCallback(): typeof OWNED_CALLABLE_UNAVAILABLE {
            return OWNED_CALLABLE_UNAVAILABLE;
          },),
      },);
  },);
}
