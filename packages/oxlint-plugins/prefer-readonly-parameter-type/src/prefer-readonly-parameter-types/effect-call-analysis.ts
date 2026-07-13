/**
 * Semantic call classification for callable effect summaries.
 *
 * @module
 */

import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';
import type { CallExpression, } from 'typescript/unstable/ast';
import {
  isIdentifier,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';

import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';
import { applyAuditedCallableEffect, } from './effect-imported-callable.ts';
import { effectCallName, } from './effect-call-name.ts';
import {
  expressionCanCarryMutableState,
  receiverElementsArePrimitive,
} from './effect-primitive-origin.ts';
import {
  addEffectIndex,
  callableKey,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import {
  addOpaqueEffect,
  ALL_PACKAGED_PROPERTIES,
  callableDeclaration,
  parameterIndex,
  parameterIndexes,
} from './effect-call-resolution.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
} from './mutation-contract-query.ts';
import { addIntrinsicCallbackEffects, } from './effect-intrinsic-callback.ts';
import {
  isGlobalStringConversion,
  STRING_OBJECT_COERCION_PROVENANCE,
} from './string-coercion-effect.ts';

/**
 * Classifies one call as callback relation, intrinsic effect, owned edge, or opaque boundary.
 *
 * @param project - TypeScript project resolving symbols.
 *
 * @param checker - TypeScript checker resolving call receiver.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param call - Call expression to classify.
 *
 * @param summary - Current callable summary receiving facts.
 *
 * @mutates summary - Adds call, mutation, callback, or opaque effect facts.
 *
 * @example
 * ```ts
 * inspectEffectCall({ project, checker, bindingOriginBySymbolId, call, summary });
 * ```
 */
export function inspectEffectCall({
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
},): void {
  /**
   * Index when direct callee identifier is current callback parameter.
   */
  const callbackParameterIndex = isIdentifier(call.expression,)
    ? parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: call.expression,
    },)
    : PARAMETER_INDEX_UNAVAILABLE;
  if (callbackParameterIndex !== PARAMETER_INDEX_UNAVAILABLE) {
    addEffectIndex({
      target: summary.directMutated,
      value: callbackParameterIndex,
    },);
    call.arguments
      .forEach(function callbackArgument(
        argument,
        callbackArgumentIndex,
      ): void {
        /**
         * Source parameter passed to callback argument, when direct.
         */
        const sourceParameterIndexes = parameterIndexes({
          checker,
          bindingOriginBySymbolId,
          node: argument,
          includedPropertyNames: ALL_PACKAGED_PROPERTIES,
        },);
        sourceParameterIndexes.forEach(function callbackSource(
          sourceParameterIndex,
        ): void {
          summary.relations
            .push({
              callbackParameterIndex,
              callbackArgumentIndex,
              sourceParameterIndex,
            },);
        },);
      },);
    return;
  }

  if (applyAuditedCallableEffect({
    project,
    checker,
    bindingOriginBySymbolId,
    call,
    summary,
  },))
    return;

  if (isPropertyAccessExpression(call.expression,)) {
    /**
     * Method receiver expression.
     */
    const receiver = call.expression
      .expression;
    /**
     * Current parameter owning receiver, when direct or nested.
     */
    const receiverParameterIndex = parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: receiver,
    },);
    /**
     * Semantic receiver type for intrinsic provenance.
     */
    const receiverType = checker.getTypeAtLocation(receiver,);
    /**
     * Semantic member symbol for exact intrinsic identity.
     */
    const memberSymbol = checker.getSymbolAtLocation(call.expression
      .name,);
    if ((receiverType !== undefined) && (memberSymbol !== undefined)) {
      /**
       * Exact intrinsic lookup query, or unsupported provenance sentinel.
       */
      const query = intrinsicEffectQuery({
        project,
        receiverType,
        memberSymbol,
      },);
      /**
       * Catalog effect, or unsupported exact-symbol sentinel.
       */
      const effect = query === NO_INTRINSIC_QUERY
        ? NO_INTRINSIC_EFFECT
        : intrinsicEffect(query,);
      if ((effect !== NO_INTRINSIC_EFFECT)
        && ((effect.requiresPrimitiveReceiverElements !== true)
          || receiverElementsArePrimitive({
            checker,
            type: receiverType,
          },))) {
        effect.targets
          .forEach(function intrinsicTarget(target,): void {
            if (target.kind === 'receiver') {
              addEffectIndex({
                target: summary.directMutated,
                value: receiverParameterIndex,
              },);
              return;
            }
            /**
             * Call argument named by intrinsic target.
             */
            const argument = call.arguments[target.index];
            if (argument === undefined)
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
        if (effect.callbacks !== undefined) {
          addIntrinsicCallbackEffects({
            project,
            checker,
            bindingOriginBySymbolId,
            call,
            receiverParameterIndex,
            callbackEffects: effect.callbacks,
            summary,
          },);
        }
        return;
      }
    }
  }

  /**
   * Selected call signature for overload-aware declaration resolution.
   */
  const resolvedSignature = checker.getResolvedSignature(call,);
  /**
   * Function-like declaration selected by resolved signature.
   */
  const resolvedDeclaration = resolvedSignature
    ?.declaration
    ?.resolve(project,);
  /**
   * Owned callee declaration selected by signature or symbol fallback.
   */
  const signatureCallee = (resolvedDeclaration !== undefined)
    && isEffectCallableDeclaration(resolvedDeclaration,)
    ? callableDeclaration({
      project,
      node: resolvedDeclaration,
    },)
    : OWNED_CALLABLE_UNAVAILABLE;
  /**
   * Owned callee selected by signature or expression symbol fallback.
   */
  const callee = signatureCallee === OWNED_CALLABLE_UNAVAILABLE
    ? callableDeclaration({
      project,
      node: call.expression,
    },)
    : signatureCallee;
  /**
   * Caller parameter roots corresponding to call arguments.
   */
  const allArgumentIndexes = call.arguments
    .map(function argumentIndex(argument,): readonly number[] {
      return parameterIndexes({
        checker,
        bindingOriginBySymbolId,
        node: argument,
        includedPropertyNames: ALL_PACKAGED_PROPERTIES,
      },);
    },);
  if (callee !== OWNED_CALLABLE_UNAVAILABLE) {
    /**
     * Authored mutation contracts identifying destructured callee targets.
     */
    const contracts = mutationContractsForDeclaration({
      declaration: callee,
      sourceFile: callee.getSourceFile(),
    },);
    /**
     * Object property names that callee declares as mutable.
     */
    const mutatedPropertyNames = contracts === MUTATION_CONTRACT_UNAVAILABLE
      ? ALL_PACKAGED_PROPERTIES
      : new Set(contracts.blocks
        .map(function mutationTarget(block,): string {
          return block.parameterName;
        },),);
    /**
     * Caller origins narrowed to declared destructured mutation targets.
     */
    const argumentIndexes = call.arguments
      .map(function ownedArgumentIndex(argument,): readonly number[] {
        return parameterIndexes({
          checker,
          bindingOriginBySymbolId,
          node: argument,
          includedPropertyNames: mutatedPropertyNames,
        },);
      },);
    summary.calls
      .push({
        calleeKey: callableKey(callee,),
        arguments: argumentIndexes,
        callbackKeys: call.arguments
          .map(function callbackKey(argument,) {
            /**
             * Owned callback declaration for current argument.
             */
            const callback = callableDeclaration({
              project,
              node: argument,
            },);
            return callback === OWNED_CALLABLE_UNAVAILABLE
              ? OWNED_CALLABLE_UNAVAILABLE
              : callableKey(callback,);
          },),
      },);
    return;
  }

  /**
   * Authored unresolved call target retained for adapter verification.
   */
  const opaqueProvenance = isGlobalStringConversion({
    call,
    checker,
    project,
  },)
    ? STRING_OBJECT_COERCION_PROVENANCE
    : effectCallName(call.expression,);
  addOpaqueEffect({
    summary,
    affectedParameterIndex: isPropertyAccessExpression(call.expression,)
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
    provenance: opaqueProvenance,
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
        provenance: opaqueProvenance,
      },);
    },);
  },);
}
