/**
 * Semantic call classification for callable effect summaries.
 *
 * @module
 */

import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';
import type {
  CallExpression,
  FunctionLikeDeclaration,
  Node,
} from 'typescript/unstable/ast';
import {
  isFunctionLikeDeclaration,
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
import {
  addEffectIndex,
  callableKey,
  expressionRoot,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Checker and Node mirror TypeScript semantic identities required for symbol lookup. */
/**
 * Maps expression root symbol to callable parameter index.
 *
 * @param checker - TypeScript checker resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Local binding symbols mapped to source parameters.
 *
 * @param node - Expression whose root may be parameter.
 *
 * @returns parameter index or sentinel.
 */
function parameterIndex({
  checker,
  bindingOriginBySymbolId,
  node,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly node: Node;
},): number | typeof PARAMETER_INDEX_UNAVAILABLE {
  /**
   * Root expression node before symbol resolution.
   */
  const root = expressionRoot(node,);
  if (!isIdentifier(root,))
    return PARAMETER_INDEX_UNAVAILABLE;
  /**
   * Root symbol resolved in current project.
   */
  const symbol = checker.getSymbolAtLocation(root,);
  if (symbol === undefined)
    return PARAMETER_INDEX_UNAVAILABLE;
  return bindingOriginBySymbolId.get(symbol.id,)
    ?? PARAMETER_INDEX_UNAVAILABLE;
}

/**
 * Resolves call target or callback expression to owned function-like declaration.
 *
 * @param project - TypeScript project resolving declaration handles.
 *
 * @param node - Callee or callback expression.
 *
 * @returns owned function-like declaration or sentinel.
 */
function callableDeclaration({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): FunctionLikeDeclaration | typeof OWNED_CALLABLE_UNAVAILABLE {
  if (isFunctionLikeDeclaration(node,))
    return node;
  /**
   * Resolved symbol for identifier or expression.
   */
  const symbol = isIdentifier(node,)
    ? project.checker
      .getResolvedSymbol(node,)
    : project.checker
      .getSymbolAtLocation(node,);
  /**
   * Preferred value declaration handle, with first declaration fallback.
   */
  const handle = symbol?.valueDeclaration
    ?? symbol?.declarations
    .at(0,);
  /**
   * Resolved declaration node in current project.
   */
  const declaration = handle?.resolve(project,);
  return (declaration !== undefined) && isFunctionLikeDeclaration(declaration,)
    ? declaration
    : OWNED_CALLABLE_UNAVAILABLE;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project, Checker, and CallExpression mirror TypeScript semantic identities required for call effects. */
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
    call.arguments
      .forEach(function callbackArgument(
      argument,
      callbackArgumentIndex,
    ): void {
      /**
       * Source parameter passed to callback argument, when direct.
       */
      const sourceParameterIndex = parameterIndex({
        checker,
        bindingOriginBySymbolId,
        node: argument,
      },);
      if (sourceParameterIndex !== PARAMETER_INDEX_UNAVAILABLE) {
        summary.relations
          .push({
          callbackParameterIndex,
          callbackArgumentIndex,
          sourceParameterIndex,
        },);
      }
    },);
    return;
  }

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
      if (effect !== NO_INTRINSIC_EFFECT) {
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
          addEffectIndex({
            target: summary.directMutated,
            value: argument === undefined
              ? PARAMETER_INDEX_UNAVAILABLE
              : parameterIndex({
                checker,
                bindingOriginBySymbolId,
                node: argument,
              },),
          },);
        },);
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
  const callee = (resolvedDeclaration !== undefined)
    && isFunctionLikeDeclaration(resolvedDeclaration,)
    ? resolvedDeclaration
    : callableDeclaration({
      project,
      node: call.expression,
    },);
  /**
   * Caller parameter roots corresponding to call arguments.
   */
  const argumentIndexes = call.arguments
    .map(function argumentIndex(argument,) {
    return parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: argument,
    },);
  },);
  if (callee !== OWNED_CALLABLE_UNAVAILABLE) {
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

  addEffectIndex({
    target: summary.directOpaque,
    value: isPropertyAccessExpression(call.expression,)
      ? parameterIndex({
        checker,
        bindingOriginBySymbolId,
        node: call.expression
          .expression,
      },)
      : PARAMETER_INDEX_UNAVAILABLE,
  },);
  argumentIndexes.forEach(function opaqueArgument(index,): void {
    addEffectIndex({
      target: summary.directOpaque,
      value: index,
    },);
  },);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
