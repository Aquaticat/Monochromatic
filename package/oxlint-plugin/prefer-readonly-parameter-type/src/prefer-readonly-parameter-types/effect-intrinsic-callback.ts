/**
 * Audited intrinsic callback-effect recording.
 *
 * @module
 */

import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';
import type { CallExpression, } from 'typescript/unstable/ast';

import type { IntrinsicCallbackEffect, } from './intrinsic-effect-catalog.ts';
import { isAuditedObservationalExpression, } from './effect-call-observation.ts';
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
 * @param foreignInbound - Whether intrinsic call belongs directly to summary callable.
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
  foreignInbound,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly receiverParameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly callbackEffects: readonly IntrinsicCallbackEffect[];
  readonly summary: MutableEffectSummary;
  readonly foreignInbound: boolean;
},): void {
  if (receiverParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return;
  callbackEffects.forEach(function intrinsicCallbackEffect(callbackEffect,): void {
    /**
     * Exact call arity selecting this callback relation when present.
     */
    const { callArgumentCount, } = callbackEffect;
    if (callArgumentCount !== undefined) {
      /**
       * Actual call arity used to select overloaded callback position.
       */
      const { length: actualArgumentCount, } = call.arguments;
      if (callArgumentCount !== actualArgumentCount)
        return;
    }
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
    if (isAuditedObservationalExpression({
      project,
      checker,
      expression: callbackArgument,
    },))
      return;
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
    /**
     * Caller receiver origin mapped to callback value parameters.
     */
    const callbackSources = callback.parameters
      .map(function callbackSource(
        _parameter,
        callbackArgumentIndex,
      ): readonly number[] {
        return receiverIndexes.has(callbackArgumentIndex,)
          ? [receiverParameterIndex,]
          : [];
      },);
    summary.calls
      .push({
        calleeKey: callableKey(callback,),
        arguments: callbackSources,
        foreignArguments: callbackSources,
        directForeignArguments: callback.parameters
          .map(function noDirectForeignArgument(): boolean {
            return false;
          },),
        foreignInbound,
        callbackKeys: callback.parameters
          .map(function noNestedCallback(): typeof OWNED_CALLABLE_UNAVAILABLE {
            return OWNED_CALLABLE_UNAVAILABLE;
          },),
      },);
  },);
}
