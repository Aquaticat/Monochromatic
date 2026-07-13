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
  Node,
} from 'typescript/unstable/ast';
import {
  isIdentifier,
  isPropertyAccessExpression,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';

import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';
import { isAuditedObservationalCallable, } from './effect-call-observation.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  addEffectIndex,
  callableKey,
  type EffectCallableDeclaration,
  expressionRoot,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

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
},): EffectCallableDeclaration | typeof OWNED_CALLABLE_UNAVAILABLE {
  /**
   * Cursor follows callable variable aliases iteratively.
   */
  const cursor: { current: Node; } = { current: node, };
  /**
   * Stable node keys prevent cyclic callable alias traversal.
   */
  const visited = new Set<string>();
  while (!isEffectCallableDeclaration(cursor.current,)) {
    /**
     * Stable source span for alias-cycle detection.
     */
    const cursorKey = `${cursor.current
      .getSourceFile()
      .fileName}:${String(cursor.current
        .pos,)}:${String(cursor.current
          .end,)}`;
    if (visited.has(cursorKey,))
      return OWNED_CALLABLE_UNAVAILABLE;
    visited.add(cursorKey,);
    /**
     * Resolved symbol for identifier or expression.
     */
    const symbol = isIdentifier(cursor.current,)
      ? project.checker
        .getResolvedSymbol(cursor.current,)
      : project.checker
        .getSymbolAtLocation(cursor.current,);
    /**
     * Preferred value declaration handle, with first declaration fallback.
     */
    const handle = symbol?.valueDeclaration
      ?? symbol?.declarations
      .at(0,);
    /**
     * Resolved declaration in current project.
     */
    const declaration = handle?.resolve(project,);
    if (declaration === undefined)
      return OWNED_CALLABLE_UNAVAILABLE;
    if (isVariableDeclaration(declaration,)
      && (declaration.initializer !== undefined)) {
      cursor.current = declaration.initializer;
      continue;
    }
    cursor.current = declaration;
  }
  /**
   * Owned callable declaration reached after alias traversal.
   */
  const declaration = cursor.current;
  /**
   * Source file used to reject declaration and external-library boundaries.
   */
  const sourceFile = declaration.getSourceFile();
  return sourceFile.isDeclarationFile
    || project.program
    .isSourceFileFromExternalLibrary(sourceFile,)
    ? OWNED_CALLABLE_UNAVAILABLE
    : declaration;
}

/**
 * Records unresolved external effect and callable provenance.
 *
 * @param summary - Callable summary receiving opaque effect.
 *
 * @param affectedParameterIndex - Affected source parameter index.
 *
 * @param provenance - Authored external call expression text.
 *
 * @mutates summary - Adds opaque index and provenance evidence.
 */
function addOpaqueEffect({
  summary,
  affectedParameterIndex,
  provenance,
}: {
  readonly summary: MutableEffectSummary;
  readonly affectedParameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly provenance: string;
},): void {
  if (affectedParameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return;
  summary.directOpaque
    .add(affectedParameterIndex,);
  /**
   * Existing provenance facts for parameter, or new accumulator.
   */
  const provenanceFacts = summary.opaqueProvenanceByParameter
    .get(affectedParameterIndex,)
    ?? new Set<string>();
  provenanceFacts.add(provenance,);
  summary.opaqueProvenanceByParameter
    .set(
      affectedParameterIndex,
      provenanceFacts,
    );
}

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

  if (isAuditedObservationalCallable({
    project,
    checker,
    call,
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

  /**
   * Authored unresolved call target retained for adapter verification.
   */
  const opaqueProvenance = call.expression
    .getText();
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
  argumentIndexes.forEach(function opaqueArgument(
    index,
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
    addOpaqueEffect({
      summary,
      affectedParameterIndex: index,
      provenance: opaqueProvenance,
    },);
  },);
}
