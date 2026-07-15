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
import { applyExternalEffect, } from './effect-external-application.ts';
import {
  type ExternalCallableEffectResolver,
  EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE,
} from './external-callable-effect.ts';
import { addOwnedCallEdge, } from './effect-owned-call-edge.ts';
import { effectCallName, } from './effect-call-name.ts';
import { applyIntrinsicEffect, } from './effect-intrinsic-application.ts';
import { intrinsicReceiverParameterIndex, } from './effect-intrinsic-result-origin.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  addEffectIndex,
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
  isGlobalStringConversion,
  STRING_OBJECT_COERCION_PROVENANCE,
} from './string-coercion-effect.ts';
import { expressionIsPlainData, } from './plain-data-classifier.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';

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
    const receiverParameterIndex = intrinsicReceiverParameterIndex({
      project,
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
        && applyIntrinsicEffect({
          project,
          checker,
          bindingOriginBySymbolId,
          call,
          receiverType,
          receiverParameterIndex,
          effect,
          summary,
          foreignInbound,
        },))
        return;
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
  /**
   * Origin call location naming where each remediation applies.
   */
  const originLocation = effectOriginLocation({ node: call, },);
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
    /* Exact global String never mutates its input; its only effect class is
     * coercion hooks, which statically plain data cannot carry. */
    if ((opaqueProvenance === STRING_OBJECT_COERCION_PROVENANCE)
      && expressionIsPlainData({
        checker,
        project,
        node: argument,
      },))
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
