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

import { applyExternalEffect, } from './effect-external-application.ts';
import {
  type ExternalCallableEffectResolver,
  EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE,
} from './external-callable-effect.ts';
import { addOwnedCallEdge, } from './effect-owned-call-edge.ts';
import { isDefaultLibraryArrayBrandDeclaration, } from './effect-default-library-array-brand.ts';
import {
  COLLECTION_CALL_DERIVED,
  COLLECTION_CALL_RECEIVER_DERIVED,
  COLLECTION_CALL_UNDERIVED,
  recordCollectionMemberEffect,
} from './effect-collection-member-effect.ts';
import {
  addEffectIndex,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';
import {
  ALL_PACKAGED_PROPERTIES,
  callableDeclaration,
  parameterIndex,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { recordOpaqueBoundary, } from './effect-opaque-boundary.ts';

/**
 * Classifies one call as callback invocation, owned source edge, derived package edge, or opaque boundary.
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
 * @param foreignInbound - Whether call belongs directly to summary callable.
 *
 * @param analysisRoot - Optional external implementation root accepted for owned call edges.
 *
 * @param externalEffectResolver - Demand-driven package implementation analyzer.
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
  foreignInbound,
  analysisRoot,
  externalEffectResolver,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly summary: MutableEffectSummary;
  readonly foreignInbound: boolean;
  readonly analysisRoot?: string;
  readonly externalEffectResolver: ExternalCallableEffectResolver;
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
      target: summary.directInvoked,
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
  if ((resolvedDeclaration !== undefined)
    && isDefaultLibraryArrayBrandDeclaration({
      project,
      declaration: resolvedDeclaration,
    },))
    return;
  /**
   * How much of a default-library collection call the derivation answered.
   */
  const collectionCoverage = (resolvedDeclaration !== undefined)
      && isPropertyAccessExpression(call.expression,)
    ? recordCollectionMemberEffect({
      project,
      checker,
      bindingOriginBySymbolId,
      call,
      receiver: call.expression
        .expression,
      declaration: resolvedDeclaration,
      summary,
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
    },)
    : COLLECTION_CALL_UNDERIVED;
  if (collectionCoverage === COLLECTION_CALL_DERIVED)
    return;
  /**
   * Owned callee declaration selected by signature or symbol fallback.
   */
  const signatureCallee = (resolvedDeclaration !== undefined)
    && isEffectCallableDeclaration(resolvedDeclaration,)
    ? callableDeclaration({
      project,
      node: resolvedDeclaration,
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
    },)
    : OWNED_CALLABLE_UNAVAILABLE;
  /**
   * Owned callee selected by signature or expression symbol fallback.
   */
  const callee = signatureCallee === OWNED_CALLABLE_UNAVAILABLE
    ? callableDeclaration({
      project,
      node: call.expression,
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
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
  if ((callee === OWNED_CALLABLE_UNAVAILABLE)
    && (resolvedDeclaration !== undefined)) {
    /**
     * Demand-driven effect inferred from exact shipped package implementation.
     */
    const externalEffect = externalEffectResolver({
      consumerProject: project,
      call,
      declaration: resolvedDeclaration,
    },);
    if (externalEffect !== EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE) {
      applyExternalEffect({
        externalEffect,
        argumentIndexes: allArgumentIndexes,
        summary,
      },);
      return;
    }
  }
  if (callee !== OWNED_CALLABLE_UNAVAILABLE) {
    addOwnedCallEdge({
      project,
      checker,
      bindingOriginBySymbolId,
      call,
      callee,
      allArgumentIndexes,
      summary,
      foreignInbound,
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
    },);
    return;
  }

  recordOpaqueBoundary({
    checker,
    bindingOriginBySymbolId,
    call,
    allArgumentIndexes,
    summary,
    receiverDerived: collectionCoverage === COLLECTION_CALL_RECEIVER_DERIVED,
  },);
}
